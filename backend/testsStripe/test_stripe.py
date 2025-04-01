import uuid
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import (
    Customer,
    Plan,
    PlanInterval,
    Price,
    Subscription,
    SubscriptionStatus,
)


@pytest.fixture
def stripe_customer_id():
    return f"cus_{uuid.uuid4().hex}"


@pytest.fixture
def stripe_price_id():
    return f"price_{uuid.uuid4().hex}"


@pytest.fixture
def stripe_product_id():
    return f"prod_{uuid.uuid4().hex}"


@pytest.fixture
def stripe_subscription_id():
    return f"sub_{uuid.uuid4().hex}"


@pytest.fixture
def test_plan(db: Session, stripe_product_id: str):
    plan = Plan(
        name="Test Plan",
        description="Test Plan Description",
        stripe_product_id=stripe_product_id,
        active=True,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@pytest.fixture
def test_price(db: Session, test_plan, stripe_price_id: str):
    price = Price(
        plan_id=test_plan.id,
        stripe_price_id=stripe_price_id,
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
def test_customer(db: Session, test_user, stripe_customer_id: str):
    customer = Customer(
        user_id=test_user.id,  # Use the fixture directly instead of querying
        stripe_customer_id=stripe_customer_id,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@pytest.fixture
def test_subscription(
    db: Session, test_customer, test_price, stripe_subscription_id: str
):
    now = datetime.utcnow()
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
    return subscription


class TestSubscriptionStatus:
    @patch("app.api.routes.stripe.stripe")
    def test_get_subscription_status_no_subscription(
        self,
        mock_stripe,
        client: TestClient,
        normal_user_token_headers: dict,
        db: Session,
    ):
        # Test when user has no subscription
        response = client.get(
            "/stripe/subscription-status", headers=normal_user_token_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["has_active_subscription"] is False

    @patch("app.api.routes.stripe.stripe")
    def test_get_subscription_status_with_active_subscription(
        self,
        mock_stripe,
        client: TestClient,
        normal_user_token_headers: dict,
        db: Session,
        test_subscription,
    ):
        # Test when user has an active subscription
        response = client.get(
            "/stripe/subscription-status", headers=normal_user_token_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["has_active_subscription"] is True
        assert data["subscription_id"] == str(test_subscription.id)
        assert data["status"] == SubscriptionStatus.ACTIVE
        assert "current_period_end" in data
        assert data["cancel_at_period_end"] is False

    @patch("app.api.routes.stripe.stripe")
    def test_get_subscription_status_with_canceled_subscription(
        self,
        mock_stripe,
        client: TestClient,
        normal_user_token_headers: dict,
        db: Session,
        test_subscription,
    ):
        # Update subscription to canceled
        test_subscription.status = SubscriptionStatus.CANCELED
        db.add(test_subscription)
        db.commit()

        response = client.get(
            "/stripe/subscription-status", headers=normal_user_token_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["has_active_subscription"] is False


class TestCheckoutSession:
    @patch("app.api.routes.stripe.stripe")
    def test_create_checkout_session_success(
        self,
        mock_stripe,
        client: TestClient,
        normal_user_token_headers: dict,
        stripe_price_id: str,
        stripe_customer_id: str,
        test_customer,
    ):
        # Mock Stripe API responses
        mock_price = MagicMock()
        mock_price.id = stripe_price_id
        mock_stripe.Price.retrieve.return_value = mock_price

        mock_session = MagicMock()
        mock_session.id = "cs_test_123"
        mock_session.url = "https://checkout.stripe.com/test"
        mock_stripe.checkout.Session.create.return_value = mock_session

        # Test data
        checkout_data = {
            "price_id": stripe_price_id,
            "success_url": "https://example.com/success",
            "cancel_url": "https://example.com/cancel",
        }

        # Make request
        response = client.post(
            "/stripe/create-checkout-session",
            json=checkout_data,
            headers=normal_user_token_headers,
        )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == "cs_test_123"
        assert data["url"] == "https://checkout.stripe.com/test"

        # Verify Stripe API was called correctly
        mock_stripe.checkout.Session.create.assert_called_once()
        call_kwargs = mock_stripe.checkout.Session.create.call_args.kwargs
        assert call_kwargs["customer"] == stripe_customer_id
        assert call_kwargs["line_items"][0]["price"] == stripe_price_id
        assert call_kwargs["mode"] == "subscription"

    @patch("app.api.routes.stripe.stripe")
    def test_create_checkout_session_invalid_price(
        self,
        mock_stripe,
        client: TestClient,
        normal_user_token_headers: dict,
        test_customer,
    ):
        # Mock Stripe API to raise an error for invalid price
        mock_stripe.Price.retrieve.side_effect = Exception("Invalid price ID")

        # Test data with invalid price
        checkout_data = {
            "price_id": "invalid_price_id",
            "success_url": "https://example.com/success",
            "cancel_url": "https://example.com/cancel",
        }

        # Make request
        response = client.post(
            "/stripe/create-checkout-session",
            json=checkout_data,
            headers=normal_user_token_headers,
        )

        # Assertions
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data


class TestCancelSubscription:
    @patch("app.api.routes.stripe.stripe")
    def test_cancel_subscription_success(
        self,
        mock_stripe,
        client: TestClient,
        normal_user_token_headers: dict,
        test_subscription,
        stripe_subscription_id: str,
    ):
        # Mock Stripe API response
        mock_sub = MagicMock()
        mock_sub.status = "active"
        mock_sub.cancel_at_period_end = True
        mock_sub.current_period_end = (
            int(datetime.utcnow().timestamp()) + 86400
        )  # tomorrow
        mock_stripe.Subscription.modify.return_value = mock_sub

        # Make request
        response = client.post(
            f"/stripe/cancel-subscription/{stripe_subscription_id}",
            headers=normal_user_token_headers,
        )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["subscription_status"] == "active"
        assert data["cancel_at_period_end"] is True

        # Verify Stripe API was called correctly
        mock_stripe.Subscription.modify.assert_called_once_with(
            stripe_subscription_id, cancel_at_period_end=True
        )

    @patch("app.api.routes.stripe.stripe")
    def test_cancel_subscription_not_found(
        self, mock_stripe, client: TestClient, normal_user_token_headers: dict
    ):
        # Make request with non-existent subscription ID
        response = client.post(
            "/stripe/cancel-subscription/non_existent_id",
            headers=normal_user_token_headers,
        )

        # Assertions
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data


class TestPaymentMethods:
    @patch("app.api.routes.stripe.stripe")
    def test_list_payment_methods(
        self,
        mock_stripe,
        client: TestClient,
        normal_user_token_headers: dict,
        test_customer,
        stripe_customer_id: str,
    ):
        # Mock Stripe API responses
        mock_payment_method = MagicMock()
        mock_payment_method.id = "pm_test_123"
        mock_payment_method.type = "card"
        mock_payment_method.card.brand = "visa"
        mock_payment_method.card.last4 = "4242"
        mock_payment_method.card.exp_month = 12
        mock_payment_method.card.exp_year = 2025
        mock_payment_method.created = int(datetime.utcnow().timestamp())

        mock_payment_methods = MagicMock()
        mock_payment_methods.data = [mock_payment_method]
        mock_stripe.PaymentMethod.list.return_value = mock_payment_methods

        mock_customer = MagicMock()
        mock_customer.invoice_settings = {"default_payment_method": "pm_test_123"}
        mock_stripe.Customer.retrieve.return_value = mock_customer

        # Make request
        response = client.get(
            "/stripe/payment-methods", headers=normal_user_token_headers
        )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == "pm_test_123"
        assert data[0]["type"] == "card"
        assert data[0]["card"]["brand"] == "visa"
        assert data[0]["card"]["last4"] == "4242"
        assert data[0]["is_default"] is True

        # Verify Stripe API was called correctly
        mock_stripe.PaymentMethod.list.assert_called_once_with(
            customer=stripe_customer_id, type="card"
        )
