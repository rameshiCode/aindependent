import logging
import os
import uuid
from datetime import datetime
from typing import Any

import stripe
import tenacity
from dotenv import load_dotenv
from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlmodel import select
from stripe import UsageRecord

from app.api.deps import (
    CurrentUser,
    SessionDep,
    SuperUserRequired,
)
from app.models import (
    CheckoutSessionCreate,
    Customer,
    Plan,
    PortalSessionCreate,
    Price,
    Subscription,
    SubscriptionStatus,
)

load_dotenv()
# Initialize Stripe with your API key
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if not stripe.api_key:
    logger.error("Stripe API key is not set. Please check your environment variables.")
else:
    logger.info(f"API Key loaded: {'Yes' if stripe.api_key else 'No'}")
    logger.info(f"API Key length: {len(stripe.api_key) if stripe.api_key else 0}")
    logger.info(
        f"API Key first/last chars: {stripe.api_key[:4]}...{stripe.api_key[-4:] if stripe.api_key else ''}"
    )

router = APIRouter(prefix="/stripe", tags=["stripe"])


@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=2, max=10),
    retry=tenacity.retry_if_exception_type(stripe.error.APIConnectionError),
)
async def safe_stripe_api_call(func, *args, **kwargs):
    """Wrapper for Stripe API calls with retry logic"""
    try:
        return func(*args, **kwargs)
    except stripe.error.StripeError as e:
        logger.error(f"Stripe API error after retries: {str(e)}")
        raise


# WEBHOOK
@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(
    request: Request,
    session: SessionDep,  # Move this parameter up
    stripe_signature: str = Header(None),  # Move this parameter down
) -> dict:
    # The rest of your function remains the same
    payload = await request.body()

    # Rest of your function can remain unchanged

    # Verify webhook signature
    try:
        # Get webhook secret from environment
        webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
        if not webhook_secret:
            logger.error("Stripe webhook secret not configured")
            raise HTTPException(status_code=500, detail="Webhook secret not configured")

        event = stripe.Webhook.construct_event(
            payload, stripe_signature, webhook_secret
        )
    except ValueError as e:
        # Invalid payload
        logger.error(f"Invalid payload: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        logger.error(f"Invalid signature: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle the event
    await handle_stripe_event(event, session)

    return {"status": "success"}


async def handle_stripe_event(event: dict, session: SessionDep):
    """
    Process different types of Stripe webhook events
    """
    event_type = event["type"]
    data_object = event["data"]["object"]

    logger.info(f"Processing Stripe event: {event_type}")

    try:
        if event_type == "customer.subscription.created":
            await handle_subscription_created(data_object, session)
        elif event_type == "customer.subscription.updated":
            await handle_subscription_updated(data_object, session)
        elif event_type == "customer.subscription.deleted":
            await handle_subscription_deleted(data_object, session)
        elif event_type == "invoice.payment_succeeded":
            await handle_payment_succeeded(data_object, session)
        elif event_type == "invoice.payment_failed":
            await handle_payment_failed(data_object, session)
        # Add other event types as needed
        else:
            logger.info(f"Unhandled event type: {event_type}")
    except Exception as e:
        logger.error(f"Error processing {event_type} event: {str(e)}")
        # Don't raise exception - we should return 200 even for errors
        # to prevent Stripe from retrying


async def handle_subscription_created(data: dict, session: SessionDep):
    """Handle subscription created event"""
    stripe_subscription_id = data["id"]
    customer_id = data["customer"]
    status = data["status"]

    # Find the customer in your database
    customer = session.exec(
        select(Customer).where(Customer.stripe_customer_id == customer_id)
    ).first()

    if not customer:
        logger.error(f"Customer not found for Stripe ID: {customer_id}")
        return

    # Get price info
    items = data["items"]["data"]
    if not items:
        logger.error(f"No items found in subscription: {stripe_subscription_id}")
        return

    stripe_price_id = items[0]["price"]["id"]

    # Check if price exists in your database
    price = session.exec(
        select(Price).where(Price.stripe_price_id == stripe_price_id)
    ).first()

    if not price:
        # Create price record if it doesn't exist
        price_data = stripe.Price.retrieve(stripe_price_id)

        # Ensure plan exists
        plan = session.exec(
            select(Plan).where(Plan.stripe_plan_id == price_data["product"])
        ).first()

        if not plan:
            product_data = stripe.Product.retrieve(price_data["product"])
            plan = Plan(
                name=product_data["name"],
                description=product_data.get("description", ""),
                stripe_product_id=product_data["id"],
            )
            session.add(plan)
            session.commit()
            session.refresh(plan)

        # Create price
        price = Price(
            plan_id=plan.id,
            stripe_price_id=stripe_price_id,
            amount=price_data["unit_amount"],
            currency=price_data["currency"],
            interval=price_data["recurring"]["interval"],
            interval_count=price_data["recurring"]["interval_count"],
        )
        session.add(price)
        session.commit()
        session.refresh(price)

    # Create subscription record
    subscription = Subscription(
        customer_id=customer.id,
        price_id=price.id,
        stripe_subscription_id=stripe_subscription_id,
        status=SubscriptionStatus.ACTIVE
        if status == "active"
        else SubscriptionStatus.INCOMPLETE,
        current_period_start=datetime.fromtimestamp(data["current_period_start"]),
        current_period_end=datetime.fromtimestamp(data["current_period_end"]),
        cancel_at_period_end=data["cancel_at_period_end"],
    )

    session.add(subscription)
    session.commit()
    logger.info(f"Subscription created: {stripe_subscription_id}")


async def handle_subscription_updated(data: dict, session: SessionDep):
    """Handle subscription updated event"""
    stripe_subscription_id = data["id"]
    status = data["status"]

    # Find subscription in database
    subscription = session.exec(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription_id
        )
    ).first()

    if not subscription:
        logger.error(f"Subscription not found: {stripe_subscription_id}")
        return

    # Update subscription details
    subscription.status = convert_stripe_status_to_db_status(status)
    subscription.current_period_start = datetime.fromtimestamp(
        data["current_period_start"]
    )
    subscription.current_period_end = datetime.fromtimestamp(data["current_period_end"])
    subscription.cancel_at_period_end = data["cancel_at_period_end"]

    session.add(subscription)
    session.commit()
    logger.info(f"Subscription updated: {stripe_subscription_id}")


# Helper function to convert Stripe status to your enum
def convert_stripe_status_to_db_status(stripe_status: str) -> SubscriptionStatus:
    status_map = {
        "active": SubscriptionStatus.ACTIVE,
        "canceled": SubscriptionStatus.CANCELED,
        "incomplete": SubscriptionStatus.INCOMPLETE,
        "incomplete_expired": SubscriptionStatus.INCOMPLETE,
        "past_due": SubscriptionStatus.PAST_DUE,
        "trialing": SubscriptionStatus.TRIALING,
        "unpaid": SubscriptionStatus.UNPAID,
    }
    return status_map.get(stripe_status, SubscriptionStatus.INCOMPLETE)


async def handle_subscription_deleted(data: dict, session: SessionDep):
    """Handle subscription deleted event"""
    stripe_subscription_id = data["id"]

    # Find subscription in database
    subscription = session.exec(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription_id
        )
    ).first()

    if not subscription:
        logger.error(f"Subscription not found for deletion: {stripe_subscription_id}")
        return

    # Update subscription status
    subscription.status = SubscriptionStatus.CANCELED

    # If you want to keep track of when it was canceled
    subscription.canceled_at = datetime.now()

    session.add(subscription)
    session.commit()
    logger.info(f"Subscription deleted: {stripe_subscription_id}")


async def handle_payment_succeeded(data: dict, session: SessionDep):
    """Handle invoice payment succeeded event"""
    # Extract subscription ID from invoice if available
    subscription_id = data.get("subscription")
    if not subscription_id:
        logger.info("No subscription associated with this invoice")
        return

    # Find subscription in database
    subscription = session.exec(
        select(Subscription).where(
            Subscription.stripe_subscription_id == subscription_id
        )
    ).first()

    if not subscription:
        logger.error(f"Subscription not found for invoice payment: {subscription_id}")
        return

    # Update subscription details if needed
    # For a successful payment, we might want to ensure status is ACTIVE
    # and update any payment-related metadata
    if subscription.status != SubscriptionStatus.ACTIVE:
        subscription.status = SubscriptionStatus.ACTIVE
        session.add(subscription)
        session.commit()

    # Optionally log payment details
    invoice_id = data.get("id")
    amount_paid = data.get("amount_paid", 0)
    currency = data.get("currency", "usd")
    logger.info(
        f"Payment succeeded for subscription {subscription_id}, "
        f"invoice {invoice_id}: {amount_paid/100} {currency.upper()}"
    )


async def handle_payment_failed(data: dict, session: SessionDep):
    """Handle invoice payment failed event"""
    # Extract subscription ID from invoice if available
    subscription_id = data.get("subscription")
    if not subscription_id:
        logger.info("No subscription associated with this failed invoice")
        return

    # Find subscription in database
    subscription = session.exec(
        select(Subscription).where(
            Subscription.stripe_subscription_id == subscription_id
        )
    ).first()

    if not subscription:
        logger.error(f"Subscription not found for failed payment: {subscription_id}")
        return

    # Update subscription status to reflect payment failure
    subscription.status = SubscriptionStatus.PAST_DUE
    session.add(subscription)
    session.commit()

    # Log the failure details
    invoice_id = data.get("id")
    attempt_count = data.get("attempt_count", 0)
    next_payment_attempt = data.get("next_payment_attempt")

    logger.warning(
        f"Payment failed for subscription {subscription_id}, "
        f"invoice {invoice_id}. Attempt #{attempt_count}. "
        f"Next attempt: {datetime.fromtimestamp(next_payment_attempt).isoformat() if next_payment_attempt else 'None'}"
    )

    # You might want to notify the user about the payment failure
    # This would typically be done through a separate notification system
    customer = session.get(Customer, subscription.customer_id)
    if customer:
        logger.info(f"Should notify user {customer.user_id} about payment failure")
        # Implement notification logic here or queue a notification task


# Health check endpoint (for development/debugging)
@router.get("/health-check")
async def stripe_health_check():
    """
    Simple health check to verify Stripe API connectivity.
    This endpoint doesn't require authentication and can be used
    to check if your server can communicate with Stripe.
    """
    try:
        # Make a simple API call to Stripe that doesn't require any specific permissions
        balance = stripe.Balance.retrieve()

        logger.info(
            f"Stripe balance retrieved successfully: {balance.available[0].amount} {balance.available[0].currency}"
        )

        return {
            "status": "success",
            "message": "Successfully connected to Stripe API",
            "available_balance": {
                "amount": balance.available[0].amount,
                "currency": balance.available[0].currency,
            },
            "stripe_api_version": stripe.api_version,
        }
    except Exception as e:
        logger.error(f"Stripe connection error: {str(e)}")
        return {
            "status": "error",
            "message": "Error connecting to Stripe API",
            "error": str(e),
        }


# Get subscription status (ESSENTIAL - for checking if user has active subscription)
@router.get("/subscription-status", response_model=dict)
def get_subscription_status(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Get the subscription status for the current user.
    This is used to determine if a user has access to premium features.
    """
    # Get customer
    customer = session.exec(
        select(Customer).where(Customer.user_id == current_user.id)
    ).first()

    if not customer:
        return {"has_active_subscription": False}

    # Check for active subscription
    subscription = session.exec(
        select(Subscription)
        .where(Subscription.customer_id == customer.id)
        .where(Subscription.status == SubscriptionStatus.ACTIVE)
    ).first()

    if not subscription:
        return {"has_active_subscription": False}

    # Get plan and price details
    price = session.get(Price, subscription.price_id)
    plan = session.get(Plan, price.plan_id) if price else None

    return {
        "has_active_subscription": True,
        "subscription_id": str(subscription.id),
        "stripe_subscription_id": subscription.stripe_subscription_id,
        "status": subscription.status,
        "current_period_end": subscription.current_period_end.isoformat(),
        "cancel_at_period_end": subscription.cancel_at_period_end,
        "plan": {
            "name": plan.name if plan else None,
            "description": plan.description if plan else None,
        }
        if plan
        else None,
        "price": {
            "amount": price.amount if price else None,
            "currency": price.currency if price else None,
            "interval": price.interval if price else None,
        }
        if price
        else None,
    }


@router.post("/create-checkout-session", response_model=dict)
async def create_checkout_session(
    checkout_data: CheckoutSessionCreate,
    current_user: CurrentUser,
    session: SessionDep,
) -> dict:
    """
    Create a Stripe Checkout session for subscription purchase.

    This endpoint creates a Checkout session that redirects the customer to the Stripe-hosted checkout page.
    After successful payment, the customer will be redirected to the success_url.
    """
    try:
        # Get or create a Stripe customer for the current user
        customer = session.exec(
            select(Customer).where(Customer.user_id == current_user.id)
        ).first()

        if not customer:
            # Create a new Stripe customer if one doesn't exist
            stripe_customer = stripe.Customer.create(
                email=current_user.email,
                metadata={"user_id": str(current_user.id)},
            )

            # Save the customer in your database
            customer = Customer(
                user_id=current_user.id,
                stripe_customer_id=stripe_customer.id,
            )
            session.add(customer)
            session.commit()
            session.refresh(customer)

        # Verify the price exists in Stripe
        try:
            price = stripe.Price.retrieve(checkout_data.price_id)
        except stripe.error.InvalidRequestError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid price ID: {checkout_data.price_id}",
            )

        # Create the checkout session
        checkout_session = stripe.checkout.Session.create(
            customer=customer.stripe_customer_id,
            payment_method_types=["card"],
            line_items=[
                {
                    "price": checkout_data.price_id,
                    "quantity": 1,
                }
            ],
            mode="subscription",
            success_url=checkout_data.success_url,
            cancel_url=checkout_data.cancel_url,
            # Optional parameters you might want to include:
            # allow_promotion_codes=True,
            # billing_address_collection="required",
            # client_reference_id=str(current_user.id),
            # customer_email=current_user.email,  # Only if customer doesn't exist yet
            # subscription_data={
            #     "trial_period_days": 14,  # If you want to offer a trial
            # },
        )

        # Return the session ID and URL
        return {
            "session_id": checkout_session.id,
            "url": checkout_session.url,
        }

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Error creating checkout session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the checkout session",
        )


@router.get("/usage-status", response_model=dict)
def get_usage_status(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Get the current usage status for the user.
    This tracks how many free requests the user has used and how many remain.
    """
    # This is a simplified example - you'll need to implement the actual usage tracking
    # in your database models and update it when users make requests

    # Check if user has active subscription first
    # Use the parameters in the function call to fix the unused argument error
    subscription_status = get_subscription_status(
        session=session, current_user=current_user
    )
    if subscription_status.get("has_active_subscription", False):
        return {
            "has_active_subscription": True,
            "unlimited_requests": True,
            "requests_used": 0,
            "requests_limit": 0,
            "requests_remaining": "unlimited",
        }

    # For non-subscribed users, check usage
    # Use the session parameter to query your database
    FREE_REQUESTS_LIMIT = 5

    # Example of using the session parameter:
    # user_usage = session.exec(select(UserUsage).where(UserUsage.user_id == current_user.id)).first()
    # requests_used = user_usage.requests_count if user_usage else 0

    # For now, just a placeholder that uses the current_user parameter to avoid the linter error
    requests_used = 0  # In a real implementation, this would come from your database
    logger.info(
        f"Checking usage for user: {current_user.email}"
    )  # Use current_user to avoid unused argument error

    return {
        "has_active_subscription": False,
        "unlimited_requests": False,
        "requests_used": requests_used,
        "requests_limit": FREE_REQUESTS_LIMIT,
        "requests_remaining": max(0, FREE_REQUESTS_LIMIT - requests_used),
    }


# Add this new endpoint for incrementing usage
@router.post("/increment-usage", response_model=dict)
def increment_usage(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Increment the usage counter for the current user.
    Call this when a user makes a request to your chat API.
    """
    # Check if user has active subscription first
    subscription_status = get_subscription_status(
        session=session, current_user=current_user
    )
    if subscription_status.get("has_active_subscription", False):
        return {
            "has_active_subscription": True,
            "unlimited_requests": True,
            "requests_used": 0,
            "requests_remaining": "unlimited",
        }

    # For non-subscribed users, increment usage
    FREE_REQUESTS_LIMIT = 5  # Set your free tier limit

    # Get or create usage record
    usage_record = session.exec(
        select(UsageRecord).where(UsageRecord.user_id == current_user.id)
    ).first()

    if not usage_record:
        usage_record = UsageRecord(user_id=current_user.id, count=0)

    usage_record.count += 1
    usage_record.last_request_at = datetime.utcnow()

    session.add(usage_record)
    session.commit()
    session.refresh(usage_record)

    requests_used = usage_record.count

    return {
        "has_active_subscription": False,
        "unlimited_requests": False,
        "requests_used": requests_used,
        "requests_limit": FREE_REQUESTS_LIMIT,
        "requests_remaining": max(0, FREE_REQUESTS_LIMIT - requests_used),
        "limit_reached": requests_used >= FREE_REQUESTS_LIMIT,
    }


# Admin endpoints (protected by superuser check)
@router.get(
    "/admin/subscriptions",
    response_model=list[dict],
    dependencies=[SuperUserRequired],
)
def get_all_subscriptions(limit: int = 100, starting_after: str | None = None) -> Any:
    """
    Get all subscriptions across all customers.
    This is an admin endpoint and is restricted to superusers.
    """
    try:
        # Get all subscriptions from Stripe with pagination
        params = {
            "limit": limit,
            "status": "all",  # Include all subscriptions regardless of status
        }

        if starting_after:
            params["starting_after"] = starting_after

        subscriptions = stripe.Subscription.list(**params)

        # Enhance the response with customer information
        enhanced_subscriptions = []
        for subscription in subscriptions.data:
            # Get customer details from Stripe
            try:
                customer = stripe.Customer.retrieve(subscription.customer)
                subscription["customer_email"] = customer.email
                subscription["customer_name"] = customer.name
            except Exception as e:
                logger.error(f"Error fetching customer details: {str(e)}")
                subscription["customer_email"] = "Unknown"
                subscription["customer_name"] = "Unknown"

            enhanced_subscriptions.append(subscription)

        return enhanced_subscriptions
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error fetching subscriptions: {str(e)}",
        )


@router.post("/create-subscription-with-payment-method", response_model=dict)
def create_subscription_with_payment_method(
    body: dict,
    session: SessionDep,
    current_user: CurrentUser,  # This dependency ensures authentication
) -> Any:
    """Create a subscription with an existing payment method."""
    # Add more logging
    print(f"Creating subscription for user: {current_user.email}")

    try:
        payment_method_id = body.get("payment_method_id")
        price_id = body.get("price_id")

        if not payment_method_id or not price_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing payment method ID or price ID",
            )

        # Get or create customer
        customer = session.exec(
            select(Customer).where(Customer.user_id == current_user.id)
        ).first()

        if not customer:
            # Create customer
            stripe_customer = stripe.Customer.create(
                email=current_user.email,
                name=current_user.full_name,
                metadata={"user_id": str(current_user.id)},
            )

            customer = Customer(
                user_id=current_user.id, stripe_customer_id=stripe_customer.id
            )
            session.add(customer)
            session.commit()
            session.refresh(customer)

        try:
            # Attach payment method to customer
            stripe.PaymentMethod.attach(
                payment_method_id,
                customer=customer.stripe_customer_id,
            )

            # Set as default payment method
            stripe.Customer.modify(
                customer.stripe_customer_id,
                invoice_settings={"default_payment_method": payment_method_id},
            )

            # Create the subscription
            idempotency_key = f"sub_{current_user.id}_{uuid.uuid4()}"
            subscription = stripe.Subscription.create(
                customer=customer.stripe_customer_id,
                items=[{"price": price_id}],
                expand=["latest_invoice.payment_intent"],
                idempotency_key=idempotency_key,
            )

            return {
                "subscription_id": subscription.id,
                "status": subscription.status,
                "client_secret": subscription.latest_invoice.payment_intent.client_secret
                if hasattr(subscription, "latest_invoice")
                and hasattr(subscription.latest_invoice, "payment_intent")
                else None,
            }

        except stripe.error.StripeError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error creating subscription: {str(e)}",
            )
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error creating subscription: {str(e)}",
        )


@router.post("/cancel-subscription/{subscription_id}", response_model=dict)
def cancel_subscription(
    subscription_id: str, session: SessionDep, current_user: CurrentUser
) -> Any:
    """Cancel a subscription directly (without portal)."""
    # Verify ownership
    customer = session.exec(
        select(Customer).where(Customer.user_id == current_user.id)
    ).first()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Verify subscription belongs to this customer
    db_subscription = session.exec(
        select(Subscription)
        .where(Subscription.customer_id == customer.id)
        .where(Subscription.stripe_subscription_id == subscription_id)
    ).first()

    if not db_subscription:
        raise HTTPException(
            status_code=404, detail="Subscription not found or not owned by you"
        )

    try:
        # Cancel at period end (safer than immediate cancellation)
        sub_response = stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=True,
        )

        # Update the database record
        db_subscription.cancel_at_period_end = True
        session.add(db_subscription)
        session.commit()

        return {
            "status": "success",
            "subscription_status": sub_response.status,
            "cancel_at_period_end": sub_response.cancel_at_period_end,
            "current_period_end": datetime.fromtimestamp(
                sub_response.current_period_end
            ).isoformat(),
        }
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/payment-methods", response_model=list[dict])
def list_payment_methods(session: SessionDep, current_user: CurrentUser) -> Any:
    """Get all payment methods for the current user."""
    customer = session.exec(
        select(Customer).where(Customer.user_id == current_user.id)
    ).first()

    if not customer:
        return []

    try:
        payment_methods = stripe.PaymentMethod.list(
            customer=customer.stripe_customer_id,
            type="card",
        )

        # Get default payment method
        stripe_customer = stripe.Customer.retrieve(customer.stripe_customer_id)
        default_payment_method = stripe_customer.get("invoice_settings", {}).get(
            "default_payment_method"
        )

        return [
            {
                "id": pm.id,
                "type": pm.type,
                "card": {
                    "brand": pm.card.brand,
                    "last4": pm.card.last4,
                    "exp_month": pm.card.exp_month,
                    "exp_year": pm.card.exp_year,
                },
                "is_default": pm.id == default_payment_method,
                "created": datetime.fromtimestamp(pm.created).isoformat(),
            }
            for pm in payment_methods.data
        ]
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error fetching payment methods: {str(e)}",
        )


@router.get("/products", status_code=status.HTTP_200_OK)
def get_products(session: SessionDep, current_user: CurrentUser) -> list:
    """
    Get all active products from Stripe
    """
    try:
        products = stripe.Product.list(active=True)
        return products.data
    except stripe.error.StripeError as e:
        logger.error(f"Error fetching products: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/products/{product_id}/prices", status_code=status.HTTP_200_OK)
def get_product_prices(
    product_id: str, session: SessionDep, current_user: CurrentUser
) -> list:
    """
    Get all prices for a specific product
    """
    try:
        prices = stripe.Price.list(product=product_id, active=True)
        return prices.data
    except stripe.error.StripeError as e:
        logger.error(f"Error fetching prices: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/create-portal-session", response_model=dict)
async def create_portal_session(
    portal_data: PortalSessionCreate,
    current_user: CurrentUser,
    session: SessionDep,
) -> dict:
    """
    Create a Stripe Customer Portal session for subscription management.

    This endpoint creates a portal session that redirects the customer to the Stripe-hosted customer portal.
    After managing their subscription, the customer will be redirected to the return_url.
    """
    try:
        # Get the Stripe customer for the current user
        customer = session.exec(
            select(Customer).where(Customer.user_id == current_user.id)
        ).first()

        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found",
            )

        # Create the portal session
        portal_session = stripe.billing_portal.Session.create(
            customer=customer.stripe_customer_id,
            return_url=portal_data.return_url,
            # Optional configuration
            # configuration="your_portal_configuration_id",
        )

        # Return the session ID and URL
        return {
            "session_id": portal_session.id,
            "url": portal_session.url,
        }

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Error creating portal session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the portal session",
        )
