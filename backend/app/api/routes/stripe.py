import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import Dict, Any, List

from app.api.deps import CurrentUser, SessionDep
from app.core.config import settings
from app.models import User, Message

# Initialize Stripe client
stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/stripe", tags=["stripe"])

@router.post("/create-checkout-session", response_model=Dict[str, str])
def create_checkout_session(
    request: Request,
    current_user: CurrentUser,
    session: SessionDep,
    price_id: str,
    success_url: str,
    cancel_url: str,
) -> Any:
    """Create a Stripe checkout session for subscription"""
    try:
        # Get or create a customer
        customers = stripe.Customer.list(email=current_user.email, limit=1)
        if customers.data:
            customer = customers.data[0]
        else:
            customer = stripe.Customer.create(
                email=current_user.email,
                name=current_user.full_name,
                metadata={"user_id": str(current_user.id)}
            )
            
        # Create the checkout session
        checkout_session = stripe.checkout.Session.create(
            customer=customer.id,
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
            metadata={
                "user_id": str(current_user.id)
            }
        )
        
        return {"url": checkout_session.url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/create-portal-session", response_model=Dict[str, str])
def create_portal_session(
    current_user: CurrentUser,
    session: SessionDep,
    return_url: str,
) -> Any:
    """Create a Stripe customer portal session for managing subscriptions"""
    try:
        # Find the customer
        customers = stripe.Customer.list(email=current_user.email, limit=1)
        if not customers.data:
            raise HTTPException(status_code=404, detail="No Stripe customer found")
        
        customer = customers.data[0]
        
        # Create portal session
        portal_session = stripe.billing_portal.Session.create(
            customer=customer.id,
            return_url=return_url,
        )
        
        return {"url": portal_session.url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/prices", response_model=List[Dict[str, Any]])
def get_prices(
    current_user: CurrentUser,
) -> Any:
    """Get available subscription prices"""
    try:
        prices = stripe.Price.list(
            active=True,
            expand=["data.product"],
            limit=100
        )
        
        # Filter for recurring prices and format the response
        recurring_prices = []
        for price in prices.data:
            if price.type == "recurring":
                recurring_prices.append({
                    "id": price.id,
                    "product_id": price.product.id,
                    "product_name": price.product.name,
                    "product_description": price.product.description,
                    "unit_amount": price.unit_amount,
                    "currency": price.currency,
                    "interval": price.recurring.interval,
                    "interval_count": price.recurring.interval_count,
                })
        
        return recurring_prices
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/subscription", response_model=Dict[str, Any])
def get_subscription_status(
    current_user: CurrentUser,
) -> Any:
    """Get user's current subscription status"""
    try:
        # Find the customer
        customers = stripe.Customer.list(email=current_user.email, limit=1)
        if not customers.data:
            return {"has_active_subscription": False}
        
        customer = customers.data[0]
        
        # Get subscriptions
        subscriptions = stripe.Subscription.list(
            customer=customer.id,
            status="active",
            expand=["data.default_payment_method"],
            limit=1
        )
        
        if not subscriptions.data:
            return {"has_active_subscription": False}
        
        subscription = subscriptions.data[0]
        
        return {
            "has_active_subscription": True,
            "subscription_id": subscription.id,
            "status": subscription.status,
            "current_period_end": subscription.current_period_end,
            "cancel_at_period_end": subscription.cancel_at_period_end,
            "price_id": subscription.items.data[0].price.id,
            "product_id": subscription.items.data[0].price.product,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
) -> Any:
    """Handle Stripe webhook events"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle specific webhook events here
    # For example, you could update user roles based on subscription status
    
    return JSONResponse(content={"status": "success"})