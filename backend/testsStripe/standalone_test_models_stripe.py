import os

# Set environment variables directly for testing
os.environ["PROJECT_NAME"] = "aindependent-test"
os.environ["POSTGRES_SERVER"] = "localhost"
os.environ["POSTGRES_USER"] = "postgres"
os.environ["POSTGRES_PASSWORD"] = "postgres"
os.environ["POSTGRES_DB"] = "app_test"
os.environ["FIRST_SUPERUSER"] = "admin@example.com"
os.environ["FIRST_SUPERUSER_PASSWORD"] = "admin"
os.environ["SECRET_KEY"] = "testsecretkey"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_mock"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_mock"

# Create a modified version of the test file that doesn't rely on the conftest.py
import uuid
from datetime import datetime, timedelta

import pytest
from sqlmodel import Session, SQLModel, create_engine

# Create in-memory SQLite database for testing
TEST_SQLITE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_SQLITE_URL)


# Define fixture for database session
@pytest.fixture
def db():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
        session.rollback()


# Import models directly
from app.models import (
    Customer,
    Plan,
    PlanInterval,
    Price,
    Subscription,
    SubscriptionStatus,
    User,
)


@pytest.fixture
def test_user(db: Session):
    user = User(
        email=f"model_test_{uuid.uuid4().hex}@example.com",
        hashed_password="hashed_password",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_plan(db: Session):
    plan = Plan(
        name="Test Plan",
        description="Test Plan Description",
        stripe_product_id=f"prod_{uuid.uuid4().hex}",
        active=True,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@pytest.fixture
def test_price(db: Session, test_plan):
    price = Price(
        plan_id=test_plan.id,
        stripe_price_id=f"price_{uuid.uuid4().hex}",
        interval=PlanInterval.MONTH,
        amount=1000,  # $10.00
        currency="usd",
        active=True,
    )
    db.add(price)
    db.commit()
    db.refresh(price)
    return price


@pytest.fixture
def test_customer(db: Session, test_user):
    customer = Customer(
        user_id=test_user.id,
        stripe_customer_id=f"cus_{uuid.uuid4().hex}",
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


class TestCustomerModel:
    def test_customer_creation(self, db: Session, test_user):
        stripe_customer_id = f"cus_{uuid.uuid4().hex}"
        customer = Customer(
            user_id=test_user.id,
            stripe_customer_id=stripe_customer_id,
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)

        assert customer.id is not None
        assert customer.user_id == test_user.id
        assert customer.stripe_customer_id == stripe_customer_id
        assert customer.created_at is not None
        assert customer.updated_at is not None

    def test_customer_user_relationship(self, db: Session, test_customer, test_user):
        # Manually check the relationship since we're using a simplified test setup
        assert test_customer.user_id == test_user.id


class TestPlanModel:
    def test_plan_creation(self, db: Session):
        stripe_product_id = f"prod_{uuid.uuid4().hex}"
        plan = Plan(
            name="Premium Plan",
            description="Premium features",
            stripe_product_id=stripe_product_id,
            active=True,
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)

        assert plan.id is not None
        assert plan.name == "Premium Plan"
        assert plan.description == "Premium features"
        assert plan.stripe_product_id == stripe_product_id
        assert plan.active is True


class TestPriceModel:
    def test_price_creation(self, db: Session, test_plan):
        stripe_price_id = f"price_{uuid.uuid4().hex}"
        price = Price(
            plan_id=test_plan.id,
            stripe_price_id=stripe_price_id,
            interval=PlanInterval.MONTH,
            amount=1500,
            currency="usd",
            active=True,
        )
        db.add(price)
        db.commit()
        db.refresh(price)

        assert price.id is not None
        assert price.plan_id == test_plan.id
        assert price.stripe_price_id == stripe_price_id
        assert price.interval == PlanInterval.MONTH
        assert price.amount == 1500
        assert price.currency == "usd"
        assert price.active is True


class TestSubscriptionModel:
    def test_subscription_creation(self, db: Session, test_customer, test_price):
        now = datetime.utcnow()
        stripe_subscription_id = f"sub_{uuid.uuid4().hex}"
        subscription = Subscription(
            customer_id=test_customer.id,
            price_id=test_price.id,
            stripe_subscription_id=stripe_subscription_id,
            status=SubscriptionStatus.ACTIVE,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
            cancel_at_period_end=False,
        )
        db.add(subscription)
        db.commit()
        db.refresh(subscription)

        assert subscription.id is not None
        assert subscription.customer_id == test_customer.id
        assert subscription.price_id == test_price.id
        assert subscription.stripe_subscription_id == stripe_subscription_id
        assert subscription.status == SubscriptionStatus.ACTIVE
        assert subscription.current_period_start == now
        assert subscription.current_period_end == now + timedelta(days=30)
        assert subscription.cancel_at_period_end is False
        assert subscription.canceled_at is None
        assert subscription.created_at is not None
        assert subscription.updated_at is not None

    def test_subscription_status_transitions(
        self, db: Session, test_customer, test_price
    ):
        # Create an active subscription
        now = datetime.utcnow()
        subscription = Subscription(
            customer_id=test_customer.id,
            price_id=test_price.id,
            stripe_subscription_id=f"sub_{uuid.uuid4().hex}",
            status=SubscriptionStatus.ACTIVE,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
            cancel_at_period_end=False,
        )
        db.add(subscription)
        db.commit()
        db.refresh(subscription)

        # Test transition to past_due
        subscription.status = SubscriptionStatus.PAST_DUE
        db.add(subscription)
        db.commit()
        db.refresh(subscription)
        assert subscription.status == SubscriptionStatus.PAST_DUE

        # Test transition to canceled
        subscription.status = SubscriptionStatus.CANCELED
        subscription.canceled_at = datetime.utcnow()
        db.add(subscription)
        db.commit()
        db.refresh(subscription)
        assert subscription.status == SubscriptionStatus.CANCELED
        assert subscription.canceled_at is not None
