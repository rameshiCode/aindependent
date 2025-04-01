#!/usr/bin/env python3
"""
Standalone test runner for Stripe subscription models.
This script bypasses the conftest.py configuration issues by setting up its own test environment.
"""

import os
import sys
import unittest
import uuid
from datetime import datetime, timedelta

# Add the backend directory to the path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

# Import models directly
# Use SQLite for testing
from sqlmodel import Session, SQLModel, create_engine

from app.models import (
    Customer,
    Plan,
    PlanInterval,
    Price,
    Subscription,
    SubscriptionStatus,
    User,
)

# Create in-memory SQLite database for testing
TEST_SQLITE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_SQLITE_URL)


class TestStripeModels(unittest.TestCase):
    def setUp(self):
        # Create tables
        SQLModel.metadata.create_all(engine)
        self.session = Session(engine)

        # Create test user
        self.user = User(
            email=f"model_test_{uuid.uuid4().hex}@example.com",
            hashed_password="hashed_password",
            is_active=True,
        )
        self.session.add(self.user)
        self.session.commit()
        self.session.refresh(self.user)

        # Create test plan
        self.plan = Plan(
            name="Test Plan",
            description="Test Plan Description",
            stripe_product_id=f"prod_{uuid.uuid4().hex}",
            active=True,
        )
        self.session.add(self.plan)
        self.session.commit()
        self.session.refresh(self.plan)

        # Create test price
        self.price = Price(
            plan_id=self.plan.id,
            stripe_price_id=f"price_{uuid.uuid4().hex}",
            interval=PlanInterval.MONTH,
            amount=1000,  # $10.00
            currency="usd",
            active=True,
        )
        self.session.add(self.price)
        self.session.commit()
        self.session.refresh(self.price)

        # Create test customer
        self.customer = Customer(
            user_id=self.user.id,
            stripe_customer_id=f"cus_{uuid.uuid4().hex}",
        )
        self.session.add(self.customer)
        self.session.commit()
        self.session.refresh(self.customer)

    def tearDown(self):
        self.session.close()

    def test_customer_creation(self):
        stripe_customer_id = f"cus_{uuid.uuid4().hex}"
        customer = Customer(
            user_id=self.user.id,
            stripe_customer_id=stripe_customer_id,
        )
        self.session.add(customer)
        self.session.commit()
        self.session.refresh(customer)

        self.assertIsNotNone(customer.id)
        self.assertEqual(customer.user_id, self.user.id)
        self.assertEqual(customer.stripe_customer_id, stripe_customer_id)
        self.assertIsNotNone(customer.created_at)
        self.assertIsNotNone(customer.updated_at)

        print("✅ test_customer_creation passed")

    def test_plan_creation(self):
        stripe_product_id = f"prod_{uuid.uuid4().hex}"
        plan = Plan(
            name="Premium Plan",
            description="Premium features",
            stripe_product_id=stripe_product_id,
            active=True,
        )
        self.session.add(plan)
        self.session.commit()
        self.session.refresh(plan)

        self.assertIsNotNone(plan.id)
        self.assertEqual(plan.name, "Premium Plan")
        self.assertEqual(plan.description, "Premium features")
        self.assertEqual(plan.stripe_product_id, stripe_product_id)
        self.assertTrue(plan.active)

        print("✅ test_plan_creation passed")

    def test_price_creation(self):
        stripe_price_id = f"price_{uuid.uuid4().hex}"
        price = Price(
            plan_id=self.plan.id,
            stripe_price_id=stripe_price_id,
            interval=PlanInterval.MONTH,
            amount=1500,
            currency="usd",
            active=True,
        )
        self.session.add(price)
        self.session.commit()
        self.session.refresh(price)

        self.assertIsNotNone(price.id)
        self.assertEqual(price.plan_id, self.plan.id)
        self.assertEqual(price.stripe_price_id, stripe_price_id)
        self.assertEqual(price.interval, PlanInterval.MONTH)
        self.assertEqual(price.amount, 1500)
        self.assertEqual(price.currency, "usd")
        self.assertTrue(price.active)

        print("✅ test_price_creation passed")

    def test_subscription_creation(self):
        now = datetime.utcnow()
        stripe_subscription_id = f"sub_{uuid.uuid4().hex}"
        subscription = Subscription(
            customer_id=self.customer.id,
            price_id=self.price.id,
            stripe_subscription_id=stripe_subscription_id,
            status=SubscriptionStatus.ACTIVE,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
            cancel_at_period_end=False,
        )
        self.session.add(subscription)
        self.session.commit()
        self.session.refresh(subscription)

        self.assertIsNotNone(subscription.id)
        self.assertEqual(subscription.customer_id, self.customer.id)
        self.assertEqual(subscription.price_id, self.price.id)
        self.assertEqual(subscription.stripe_subscription_id, stripe_subscription_id)
        self.assertEqual(subscription.status, SubscriptionStatus.ACTIVE)
        self.assertEqual(subscription.current_period_start, now)
        self.assertEqual(subscription.current_period_end, now + timedelta(days=30))
        self.assertFalse(subscription.cancel_at_period_end)
        self.assertIsNone(subscription.canceled_at)
        self.assertIsNotNone(subscription.created_at)
        self.assertIsNotNone(subscription.updated_at)

        print("✅ test_subscription_creation passed")

    def test_subscription_status_transitions(self):
        # Create an active subscription
        now = datetime.utcnow()
        subscription = Subscription(
            customer_id=self.customer.id,
            price_id=self.price.id,
            stripe_subscription_id=f"sub_{uuid.uuid4().hex}",
            status=SubscriptionStatus.ACTIVE,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
            cancel_at_period_end=False,
        )
        self.session.add(subscription)
        self.session.commit()
        self.session.refresh(subscription)

        # Test transition to past_due
        subscription.status = SubscriptionStatus.PAST_DUE
        self.session.add(subscription)
        self.session.commit()
        self.session.refresh(subscription)
        self.assertEqual(subscription.status, SubscriptionStatus.PAST_DUE)

        # Test transition to canceled
        subscription.status = SubscriptionStatus.CANCELED
        subscription.canceled_at = datetime.utcnow()
        self.session.add(subscription)
        self.session.commit()
        self.session.refresh(subscription)
        self.assertEqual(subscription.status, SubscriptionStatus.CANCELED)
        self.assertIsNotNone(subscription.canceled_at)

        print("✅ test_subscription_status_transitions passed")


if __name__ == "__main__":
    print("Running Stripe subscription model tests...")
    unittest.main(argv=["first-arg-is-ignored"], exit=False)
    print("All tests completed.")
