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

from app.api.deps import (
    CurrentUser,
    SessionDep,
    SuperUserRequired,
)
from app.models import (
    CheckoutSessionCreate,
    Customer,
    PaymentIntentCreate,
    PaymentIntentResponse,
    Plan,
    PortalSessionCreate,
    Price,
    Subscription,
    SubscriptionStatus,
)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Stripe with API key
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

# Log Stripe API key status (without revealing full key)
if not stripe.api_key:
    logger.error("Stripe API key is not set. Please check your environment variables.")
else:
    logger.info(f"API Key loaded: {'Yes' if stripe.api_key else 'No'}")
    logger.info(f"API Key length: {len(stripe.api_key) if stripe.api_key else 0}")
    if stripe.api_key:
        logger.info(
            f"API Key first/last chars: {stripe.api_key[:4]}...{stripe.api_key[-4:]}"
        )

# Create router
router = APIRouter(prefix="/stripe", tags=["stripe"])


# Helper retry decorator for Stripe API calls
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


# Helper function to convert Stripe status to your enum
def convert_stripe_status_to_db_status(stripe_status: str) -> SubscriptionStatus:
    """Convert Stripe subscription status to application enum"""
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


# ==================== WEBHOOK HANDLING ====================


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(
    request: Request,
    session: SessionDep,
    stripe_signature: str = Header(None),
) -> dict:
    """Process Stripe webhook events"""
    # Get request payload
    payload = await request.body()

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
    """Process different types of Stripe webhook events"""
    event_type = event["type"]
    data_object = event["data"]["object"]

    logger.info(f"Processing Stripe event: {event_type}")

    try:
        # Route the event to the appropriate handler based on event type
        handler_map = {
            "customer.subscription.created": handle_subscription_created,
            "customer.subscription.updated": handle_subscription_updated,
            "customer.subscription.deleted": handle_subscription_deleted,
            "invoice.payment_succeeded": handle_payment_succeeded,
            "invoice.payment_failed": handle_payment_failed,
        }

        # Call the handler if we have one for this event type
        handler = handler_map.get(event_type)
        if handler:
            await handler(data_object, session)
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

    # Keep track of when it was canceled
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
    if subscription.status != SubscriptionStatus.ACTIVE:
        subscription.status = SubscriptionStatus.ACTIVE
        session.add(subscription)
        session.commit()

    # Log payment details
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

    # Future notification logic could be added here
    customer = session.get(Customer, subscription.customer_id)
    if customer:
        logger.info(f"Should notify user {customer.user_id} about payment failure")


# ==================== DIAGNOSTIC ENDPOINTS ====================


@router.get("/health-check")
async def stripe_health_check():
    """
    Simple health check to verify Stripe API connectivity.
    This endpoint doesn't require authentication.
    """
    try:
        # Make a simple API call to Stripe
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


# ==================== SUBSCRIPTION ENDPOINTS ====================


@router.get("/subscription-status", response_model=dict)
def get_subscription_status(
    session: SessionDep, current_user: CurrentUser
) -> dict[str, Any]:
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
    """
    try:
        logger.info(
            f"Creating checkout session for user {current_user.id} with price {checkout_data.price_id}"
        )

        # Get or create a Stripe customer for the current user
        customer = session.exec(
            select(Customer).where(Customer.user_id == current_user.id)
        ).first()

        logger.info(f"Customer found: {customer is not None}")

        # Customer verification and recreation logic
        if customer:
            # Verify the customer exists in Stripe
            try:
                logger.info(
                    f"Verifying customer {customer.stripe_customer_id} exists in Stripe"
                )
                stripe_customer = stripe.Customer.retrieve(customer.stripe_customer_id)
                logger.info(f"Customer verified in Stripe: {stripe_customer.id}")
            except stripe.error.InvalidRequestError:
                # Customer doesn't exist in Stripe, create a new one
                logger.warning(
                    f"Customer {customer.stripe_customer_id} not found in Stripe, creating new customer"
                )
                stripe_customer = stripe.Customer.create(
                    email=current_user.email,
                    metadata={"user_id": str(current_user.id)},
                )

                # Update customer record with new Stripe ID
                customer.stripe_customer_id = stripe_customer.id
                session.add(customer)
                session.commit()
                session.refresh(customer)
                logger.info(
                    f"Customer record updated with new Stripe ID: {customer.stripe_customer_id}"
                )
        else:
            # Create a new Stripe customer if one doesn't exist
            logger.info(f"Creating new Stripe customer for user {current_user.id}")
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
            logger.info(f"Retrieving price {checkout_data.price_id} from Stripe")
            price = stripe.Price.retrieve(checkout_data.price_id)
            logger.info(f"Price found: {price.id}")
        except stripe.error.InvalidRequestError as e:
            logger.error(f"Invalid price ID: {checkout_data.price_id}, error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid price ID: {checkout_data.price_id}",
            )

        # Create the checkout session
        logger.info(
            f"Creating checkout session with customer {customer.stripe_customer_id} and price {checkout_data.price_id}"
        )
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
        )

        logger.info(f"Checkout session created: {checkout_session.id}")

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
        logger.error(f"Error creating checkout session: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the checkout session",
        )


# Update this in your stripe.py file
@router.get("/usage-status", response_model=dict)
def get_usage_status(session: SessionDep, current_user: CurrentUser) -> dict[str, Any]:
    """
    Get the current usage status for the user.
    This tracks how many free requests the user has used and how many remain.
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
            "requests_limit": 0,
            "requests_remaining": "unlimited",
        }

    # For non-subscribed users, check usage
    FREE_REQUESTS_LIMIT = 6  # Update to 6 as per your requirements

    # Import the UsageRecord from your models to avoid confusion with stripe.UsageRecord
    from app.models import UsageRecord as AppUsageRecord

    # Get usage record from database
    usage_record = session.exec(
        select(AppUsageRecord).where(AppUsageRecord.user_id == current_user.id)
    ).first()

    requests_used = usage_record.count if usage_record else 0
    logger.info(f"Checking usage for user: {current_user.email}, Used: {requests_used}")

    return {
        "has_active_subscription": False,
        "unlimited_requests": False,
        "requests_used": requests_used,
        "requests_limit": FREE_REQUESTS_LIMIT,
        "requests_remaining": max(0, FREE_REQUESTS_LIMIT - requests_used),
        "limit_reached": requests_used >= FREE_REQUESTS_LIMIT,
    }


# Add this to your stripe.py file
@router.post("/increment-usage", response_model=dict)
def increment_usage(session: SessionDep, current_user: CurrentUser) -> dict[str, Any]:
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
    FREE_REQUESTS_LIMIT = 6  # Set your free tier limit to 6

    # Import the UsageRecord from your models to avoid confusion with stripe.UsageRecord
    from app.models import UsageRecord as AppUsageRecord

    # Get or create usage record
    usage_record = session.exec(
        select(AppUsageRecord).where(AppUsageRecord.user_id == current_user.id)
    ).first()

    if not usage_record:
        usage_record = AppUsageRecord(user_id=current_user.id, count=0)

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


# ==================== ADMIN ENDPOINTS ====================


@router.get(
    "/admin/subscriptions",
    response_model=list[dict],
    dependencies=[SuperUserRequired],
)
def get_all_subscriptions(
    limit: int = 100, starting_after: str | None = None
) -> list[dict[str, Any]]:
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


# ==================== CUSTOMER PAYMENT MANAGEMENT ====================


@router.post("/create-subscription-with-payment-method", response_model=dict)
def create_subscription_with_payment_method(
    body: dict,
    session: SessionDep,
    current_user: CurrentUser,
) -> dict[str, Any]:
    """Create a subscription with an existing payment method."""
    logger.info(f"Creating subscription for user: {current_user.email}")

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
) -> dict[str, Any]:
    """Cancel a subscription at the end of the current billing period."""
    try:
        # Log the cancellation request
        logger.info(
            f"Cancellation request for subscription {subscription_id} by user {current_user.id}"
        )

        # Verify ownership
        customer = session.exec(
            select(Customer).where(Customer.user_id == current_user.id)
        ).first()

        if not customer:
            logger.error(f"Customer not found for user {current_user.id}")
            raise HTTPException(status_code=404, detail="Customer not found")

        # Verify subscription belongs to this customer
        db_subscription = session.exec(
            select(Subscription)
            .where(Subscription.customer_id == customer.id)
            .where(Subscription.stripe_subscription_id == subscription_id)
        ).first()

        if not db_subscription:
            logger.error(
                f"Subscription {subscription_id} not found for customer {customer.id}"
            )
            raise HTTPException(
                status_code=404, detail="Subscription not found or not owned by you"
            )

        # Cancel at period end (not immediately)
        logger.info(f"Canceling subscription {subscription_id} at period end")
        sub_response = stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=True,
        )

        # Update the database record
        db_subscription.cancel_at_period_end = True
        session.add(db_subscription)
        session.commit()
        logger.info(
            f"Subscription {subscription_id} marked for cancellation at period end"
        )

        return {
            "status": "success",
            "subscription_status": sub_response.status,
            "cancel_at_period_end": sub_response.cancel_at_period_end,
            "current_period_end": datetime.fromtimestamp(
                sub_response.current_period_end
            ).isoformat(),
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error canceling subscription {subscription_id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error canceling subscription {subscription_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail="An error occurred while canceling the subscription"
        )


@router.get("/payment-methods", response_model=list[dict])
def list_payment_methods(
    session: SessionDep, current_user: CurrentUser
) -> list[dict[str, Any]]:
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
def get_products() -> list[Any]:
    """Get all active products from Stripe"""
    try:
        products = stripe.Product.list(active=True)
        return products.data
    except stripe.error.StripeError as e:
        logger.error(f"Error fetching products: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/products/{product_id}/prices", status_code=status.HTTP_200_OK)
def get_product_prices(product_id: str) -> list[Any]:
    """Get all prices for a specific product"""
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


@router.post("/create-payment-intent", response_model=PaymentIntentResponse)
async def create_payment_intent(
    payment_intent_data: PaymentIntentCreate,
    current_user: CurrentUser,
    session: SessionDep,
) -> dict:
    """
    Create a payment intent for subscription setup using Stripe PaymentSheet
    """
    try:
        logger.info(
            f"Creating payment intent for user {current_user.id} with price {payment_intent_data.price_id}"
        )

        # Get or create a Stripe customer for the current user
        customer = session.exec(
            select(Customer).where(Customer.user_id == current_user.id)
        ).first()

        if not customer:
            # Create a new customer record
            stripe_customer = stripe.Customer.create(
                email=current_user.email,
                metadata={"user_id": str(current_user.id)},
            )

            customer = Customer(
                user_id=current_user.id,
                stripe_customer_id=stripe_customer.id,
            )
            session.add(customer)
            session.commit()
            session.refresh(customer)

        # Verify the price exists in Stripe
        price = session.exec(
            select(Price).where(Price.stripe_price_id == payment_intent_data.price_id)
        ).first()

        if not price:
            # Retrieve price from Stripe and create in database
            stripe_price = stripe.Price.retrieve(payment_intent_data.price_id)

            # Ensure plan exists
            plan = session.exec(
                select(Plan).where(Plan.stripe_product_id == stripe_price.product)
            ).first()

            if not plan:
                product_data = stripe.Product.retrieve(stripe_price.product)
                plan = Plan(
                    name=product_data.name,
                    description=product_data.get("description", ""),
                    stripe_product_id=product_data.id,
                )
                session.add(plan)
                session.commit()
                session.refresh(plan)

            # Create price
            price = Price(
                plan_id=plan.id,
                stripe_price_id=payment_intent_data.price_id,
                amount=stripe_price.unit_amount,
                currency=stripe_price.currency,
                interval=stripe_price.recurring.interval,
                interval_count=stripe_price.recurring.interval_count,
            )
            session.add(price)
            session.commit()
            session.refresh(price)

        # Create ephemeral key for the customer
        ephemeral_key = stripe.EphemeralKey.create(
            customer=customer.stripe_customer_id,
            stripe_version=stripe.api_version,
        )

        # Create a payment intent
        payment_intent = stripe.PaymentIntent.create(
            amount=price.amount,
            currency=price.currency,
            customer=customer.stripe_customer_id,
            setup_future_usage=payment_intent_data.setup_future_usage,
            metadata={
                "price_id": price.stripe_price_id,
                "user_id": str(current_user.id),
                **(
                    payment_intent_data.metadata if payment_intent_data.metadata else {}
                ),
            },
            automatic_payment_methods={"enabled": True},
        )

        return {
            "client_secret": payment_intent.client_secret,
            "ephemeral_key": ephemeral_key.secret,
            "customer_id": customer.stripe_customer_id,
            "publishable_key": os.environ.get("STRIPE_PUBLISHABLE_KEY"),
        }

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Error creating payment intent: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating the payment intent",
        )


@router.post("/confirm-subscription", status_code=status.HTTP_201_CREATED)
async def confirm_subscription(
    payment_intent_id: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> dict:
    """
    Confirm subscription creation after successful payment
    """
    try:
        # Retrieve the payment intent
        payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)

        if payment_intent.status != "succeeded":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment not successful. Status: {payment_intent.status}",
            )

        # Get price_id from metadata
        price_id = payment_intent.metadata.get("price_id")
        if not price_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Price ID not found in payment intent metadata",
            )

        # Get customer
        customer = session.exec(
            select(Customer).where(Customer.user_id == current_user.id)
        ).first()

        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer not found",
            )

        # Create subscription in Stripe
        subscription = stripe.Subscription.create(
            customer=customer.stripe_customer_id,
            items=[{"price": price_id}],
            expand=["latest_invoice.payment_intent"],
        )

        # Webhook will handle database updates, but we can return the subscription ID
        return {"subscription_id": subscription.id}

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Error confirming subscription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while confirming the subscription",
        )


@router.get("/details", status_code=status.HTTP_200_OK)
async def get_subscription_details(
    session: SessionDep,
    current_user: CurrentUser,
) -> dict[str, Any]:
    """
    Get detailed information about the user's active subscription.

    This endpoint provides comprehensive information about the subscription,
    including status, billing period, and plan details.
    """
    # Get customer record for current user
    customer = session.exec(
        select(Customer).where(Customer.user_id == current_user.id)
    ).first()

    if not customer:
        logger.error(f"Customer not found for user ID: {current_user.id}")
        return {"has_active_subscription": False}

    # Get active subscription for customer
    subscription = session.exec(
        select(Subscription)
        .where(Subscription.customer_id == customer.id)
        .where(Subscription.status == SubscriptionStatus.ACTIVE)
    ).first()

    if not subscription:
        logger.info(f"No active subscription found for customer ID: {customer.id}")
        return {"has_active_subscription": False}

    # Get plan and price details
    price = session.get(subscription.price_id)
    plan = session.get(price.plan_id) if price else None

    return {
        "has_active_subscription": True,
        "subscription_id": str(subscription.id),
        "stripe_subscription_id": subscription.stripe_subscription_id,
        "status": subscription.status,
        "current_period_start": subscription.current_period_start.isoformat(),
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


@router.get("/available-subscriptions", response_model=list[dict])
def get_available_subscriptions() -> list[dict[str, Any]]:
    """Get all available subscription options with formatted details for display."""
    try:
        # Get all active products
        products = stripe.Product.list(active=True)

        result = []
        for product in products.data:
            # Get prices for this product
            prices = stripe.Price.list(product=product.id, active=True)

            # Format product with prices
            formatted_product = {
                "id": product.id,
                "name": product.name,
                "description": product.description,
                "prices": [
                    {
                        "id": price.id,
                        "amount": price.unit_amount / 100,
                        "currency": price.currency,
                        "interval": price.recurring.interval,
                        "interval_count": price.recurring.interval_count,
                    }
                    for price in prices.data
                ],
            }
            result.append(formatted_product)

        return result
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))
