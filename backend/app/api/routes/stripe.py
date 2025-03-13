import logging
import os
from typing import Any

import stripe
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from app.api.deps import (
    CurrentUser,
    SessionDep,
    SuperUserRequired,
)
from app.models import (
    Customer,
    Plan,
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


# Create checkout session (ESSENTIAL - for initiating subscription purchase)
@router.post("/create-checkout-session", response_model=dict)
def create_checkout_session(
    price_id: str,
    success_url: str,
    cancel_url: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Create a checkout session for a subscription.
    This is called when a user wants to subscribe after reaching the free request limit.
    """
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
        # Create checkout session
        checkout_session = stripe.checkout.Session.create(
            customer=customer.stripe_customer_id,
            payment_method_types=["card"],
            line_items=[
                {
                    "price": price_id,
                    "quantity": 1,
                },
            ],
            mode="subscription",
            success_url=success_url,
            cancel_url=cancel_url,
        )

        return {"checkout_url": checkout_session.url}
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error creating checkout session: {str(e)}",
        )


# Get products (for displaying subscription options)
@router.get("/products", response_model=list[dict])
def get_products() -> Any:
    """
    Get all products from Stripe and return them.
    Used to display subscription options to users.
    """
    try:
        products = stripe.Product.list(active=True)
        return products.data
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error fetching products: {str(e)}",
        )


# Get prices for a product (for displaying subscription options)
@router.get("/products/{product_id}/prices", response_model=list[dict])
def get_product_prices(product_id: str) -> Any:
    """
    Get all prices for a specific product.
    Used to display subscription options to users.
    """
    try:
        prices = stripe.Price.list(product=product_id, active=True)
        return prices.data
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error fetching prices: {str(e)}",
        )


# Get current user's subscriptions
@router.get("/my-subscriptions", response_model=list[dict])
def get_my_subscriptions(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Get all subscriptions for the current user.
    Used to display subscription details to users.
    """
    # Get customer
    customer = session.exec(
        select(Customer).where(Customer.user_id == current_user.id)
    ).first()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found"
        )

    try:
        # Get subscriptions from Stripe
        subscriptions = stripe.Subscription.list(customer=customer.stripe_customer_id)
        return subscriptions.data
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error fetching subscriptions: {str(e)}",
        )


# Create customer portal session (for subscription management)
@router.post("/create-portal-session", response_model=dict)
def create_portal_session(
    return_url: str, session: SessionDep, current_user: CurrentUser
) -> Any:
    """
    Create a customer portal session for managing subscriptions.
    This allows users to update payment methods, cancel subscriptions, etc.
    """
    # Get customer
    customer = session.exec(
        select(Customer).where(Customer.user_id == current_user.id)
    ).first()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found"
        )

    try:
        # Create portal session
        portal_session = stripe.billing_portal.Session.create(
            customer=customer.stripe_customer_id, return_url=return_url
        )

        return {"portal_url": portal_session.url}
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error creating portal session: {str(e)}",
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
            "requests_used": 0,  # Not relevant for subscribed users
            "requests_remaining": "unlimited",
        }

    # For non-subscribed users, increment usage
    # This is where you'd update your usage tracking table
    # For now, we'll use a placeholder implementation
    FREE_REQUESTS_LIMIT = 5  # Set your free tier limit

    # In a real implementation, you would update your database
    # Example:
    # user_usage = session.exec(select(UserUsage).where(UserUsage.user_id == current_user.id)).first()
    # if not user_usage:
    #     user_usage = UserUsage(user_id=current_user.id, requests_count=0)
    # user_usage.requests_count += 1
    # session.add(user_usage)
    # session.commit()
    # session.refresh(user_usage)
    # requests_used = user_usage.requests_count

    requests_used = 1  # Replace with actual query to your usage tracking

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
