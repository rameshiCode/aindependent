import logging
import os
from datetime import datetime
from typing import Any

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlmodel import Session, select

from app.core.db import get_session
from app.models import Customer, Invoice, Plan, Price, Subscription, SubscriptionStatus

router = APIRouter()

# Set up logging
logger = logging.getLogger(__name__)

# Set your webhook secret
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")


@router.post("/webhook/stripe", include_in_schema=False)
async def stripe_webhook(request: Request, db: Session = Depends(get_session)) -> Any:
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature")

    if not STRIPE_WEBHOOK_SECRET:
        logger.error(
            "Webhook secret is not set. Please check your environment variables."
        )
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": "Webhook secret not configured"},
        )

    try:
        # Verify the event came from Stripe
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        logger.error(f"Invalid payload: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid signature: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

    # Log the event type
    logger.info(f"Received Stripe webhook event: {event['type']}")

    # Handle the event
    try:
        if event["type"] == "checkout.session.completed":
            handle_checkout_session_completed(db, event["data"]["object"])
        elif event["type"] == "customer.subscription.created":
            handle_subscription_created(db, event["data"]["object"])
        elif event["type"] == "customer.subscription.updated":
            handle_subscription_updated(db, event["data"]["object"])
        elif event["type"] == "customer.subscription.deleted":
            handle_subscription_deleted(db, event["data"]["object"])
        elif event["type"] == "invoice.paid":
            handle_invoice_paid(db, event["data"]["object"])
        elif event["type"] == "invoice.payment_failed":
            handle_invoice_payment_failed(db, event["data"]["object"])
        else:
            logger.info(f"Unhandled event type: {event['type']}")
    except Exception as e:
        logger.error(f"Error handling webhook event: {str(e)}")
        # We return 200 even on error to prevent Stripe from retrying
        # But we log the error for debugging
        return JSONResponse(
            content={
                "status": "error",
                "message": f"Error processing webhook: {str(e)}",
            }
        )

    return JSONResponse(content={"status": "success"})


def handle_checkout_session_completed(session_data: dict):
    """
    Handle checkout.session.completed event.
    This is fired when a customer completes the checkout process.
    """
    logger.info(
        f"Processing checkout.session.completed for session {session_data['id']}"
    )

    # Only process subscription checkouts
    if session_data["mode"] != "subscription":
        logger.info(f"Ignoring non-subscription checkout: {session_data['mode']}")
        return

    # The subscription will be created by the customer.subscription.created event
    # So we don't need to do anything here except log it
    logger.info(f"Checkout completed for customer {session_data['customer']}")


def handle_subscription_created(db: Session, subscription_data: dict):
    """
    Handle customer.subscription.created event.
    This is fired when a subscription is created.
    """
    logger.info(f"Processing subscription created: {subscription_data['id']}")

    # Find the customer
    customer = db.exec(
        select(Customer).where(
            Customer.stripe_customer_id == subscription_data["customer"]
        )
    ).first()

    if not customer:
        logger.error(
            f"Customer not found for Stripe ID: {subscription_data['customer']}"
        )
        return

    # Get the first subscription item (assuming one price per subscription)
    if not subscription_data.get("items", {}).get("data"):
        logger.error(f"No items found in subscription: {subscription_data['id']}")
        return

    stripe_price_id = subscription_data["items"]["data"][0]["price"]["id"]

    # Find or create the price
    price = db.exec(
        select(Price).where(Price.stripe_price_id == stripe_price_id)
    ).first()

    if not price:
        # Fetch price details from Stripe
        try:
            stripe_price = stripe.Price.retrieve(stripe_price_id)

            # Find or create the plan
            plan = db.exec(
                select(Plan).where(Plan.stripe_product_id == stripe_price["product"])
            ).first()

            if not plan:
                # Fetch product details from Stripe
                stripe_product = stripe.Product.retrieve(stripe_price["product"])

                # Create new plan
                plan = Plan(
                    name=stripe_product["name"],
                    description=stripe_product.get("description", ""),
                    stripe_product_id=stripe_product["id"],
                    active=stripe_product["active"],
                )
                db.add(plan)
                db.commit()
                db.refresh(plan)

            # Create new price
            price = Price(
                plan_id=plan.id,
                stripe_price_id=stripe_price_id,
                interval=stripe_price["recurring"]["interval"],
                amount=stripe_price["unit_amount"],
                currency=stripe_price["currency"],
                active=stripe_price["active"],
            )
            db.add(price)
            db.commit()
            db.refresh(price)

        except stripe.error.StripeError as e:
            logger.error(f"Error fetching price/product from Stripe: {str(e)}")
            return

    # Check if subscription already exists
    existing_subscription = db.exec(
        select(Subscription).where(
            Subscription.stripe_subscription_id == subscription_data["id"]
        )
    ).first()

    if existing_subscription:
        logger.info(f"Subscription already exists: {subscription_data['id']}")
        return

    # Create a new subscription record
    new_subscription = Subscription(
        customer_id=customer.id,
        price_id=price.id,
        stripe_subscription_id=subscription_data["id"],
        status=SubscriptionStatus(subscription_data["status"]),
        current_period_start=datetime.fromtimestamp(
            subscription_data["current_period_start"]
        ),
        current_period_end=datetime.fromtimestamp(
            subscription_data["current_period_end"]
        ),
        cancel_at_period_end=subscription_data["cancel_at_period_end"],
    )

    db.add(new_subscription)
    db.commit()
    db.refresh(new_subscription)

    logger.info(f"Created subscription record: {new_subscription.id}")


def handle_subscription_updated(db: Session, subscription_data: dict):
    """
    Handle customer.subscription.updated event.
    This is fired when a subscription is updated (e.g., plan change, renewal).
    """
    logger.info(f"Processing subscription updated: {subscription_data['id']}")

    # Find the subscription
    subscription = db.exec(
        select(Subscription).where(
            Subscription.stripe_subscription_id == subscription_data["id"]
        )
    ).first()

    if not subscription:
        logger.error(f"Subscription not found: {subscription_data['id']}")
        return

    # Update subscription fields
    subscription.status = SubscriptionStatus(subscription_data["status"])
    subscription.current_period_start = datetime.fromtimestamp(
        subscription_data["current_period_start"]
    )
    subscription.current_period_end = datetime.fromtimestamp(
        subscription_data["current_period_end"]
    )
    subscription.cancel_at_period_end = subscription_data["cancel_at_period_end"]

    # Check if price has changed
    if subscription_data.get("items", {}).get("data"):
        new_stripe_price_id = subscription_data["items"]["data"][0]["price"]["id"]

        # Find the price
        price = db.exec(
            select(Price).where(Price.stripe_price_id == new_stripe_price_id)
        ).first()

        if price and price.id != subscription.price_id:
            logger.info(
                f"Subscription price changed from {subscription.price_id} to {price.id}"
            )
            subscription.price_id = price.id

    db.add(subscription)
    db.commit()
    db.refresh(subscription)

    logger.info(f"Updated subscription: {subscription.id}")


def handle_subscription_deleted(db: Session, subscription_data: dict):
    """
    Handle customer.subscription.deleted event.
    This is fired when a subscription is canceled or expires.
    """
    logger.info(f"Processing subscription deleted: {subscription_data['id']}")

    # Find the subscription
    subscription = db.exec(
        select(Subscription).where(
            Subscription.stripe_subscription_id == subscription_data["id"]
        )
    ).first()

    if not subscription:
        logger.error(f"Subscription not found: {subscription_data['id']}")
        return

    # Update subscription status
    subscription.status = SubscriptionStatus.CANCELED
    subscription.canceled_at = datetime.utcnow()

    db.add(subscription)
    db.commit()
    db.refresh(subscription)

    logger.info(f"Marked subscription as canceled: {subscription.id}")


def handle_invoice_paid(db: Session, invoice_data: dict):
    """
    Handle invoice.paid event.
    This is fired when an invoice is paid successfully.
    """
    logger.info(f"Processing invoice paid: {invoice_data['id']}")

    # Only process subscription invoices
    if not invoice_data.get("subscription"):
        logger.info(f"Ignoring non-subscription invoice: {invoice_data['id']}")
        return

    # Find the subscription
    subscription = db.exec(
        select(Subscription).where(
            Subscription.stripe_subscription_id == invoice_data["subscription"]
        )
    ).first()

    if not subscription:
        logger.error(f"Subscription not found: {invoice_data['subscription']}")
        return

    # Check if invoice already exists
    existing_invoice = db.exec(
        select(Invoice).where(Invoice.stripe_invoice_id == invoice_data["id"])
    ).first()

    if existing_invoice:
        logger.info(f"Invoice already exists: {invoice_data['id']}")
        return

    # Create new invoice record
    new_invoice = Invoice(
        subscription_id=subscription.id,
        stripe_invoice_id=invoice_data["id"],
        amount_paid=invoice_data["amount_paid"],
        currency=invoice_data["currency"],
        status=invoice_data["status"],
        invoice_pdf=invoice_data.get("invoice_pdf"),
    )

    db.add(new_invoice)

    # Ensure subscription is marked as active
    if subscription.status != SubscriptionStatus.ACTIVE:
        subscription.status = SubscriptionStatus.ACTIVE
        db.add(subscription)

    db.commit()
    logger.info(f"Recorded paid invoice: {new_invoice.id}")


def handle_invoice_payment_failed(db: Session, invoice_data: dict):
    """
    Handle invoice.payment_failed event.
    This is fired when an invoice payment fails.
    """
    logger.info(f"Processing invoice payment failed: {invoice_data['id']}")

    # Only process subscription invoices
    if not invoice_data.get("subscription"):
        logger.info(f"Ignoring non-subscription invoice: {invoice_data['id']}")
        return

    # Find the subscription
    subscription = db.exec(
        select(Subscription).where(
            Subscription.stripe_subscription_id == invoice_data["subscription"]
        )
    ).first()

    if not subscription:
        logger.error(f"Subscription not found: {invoice_data['subscription']}")
        return

    # Update subscription status based on attempt count
    # After several failed attempts, Stripe will mark the subscription as unpaid
    # We'll reflect that in our database
    if invoice_data.get("attempt_count", 0) > 3:
        subscription.status = SubscriptionStatus.PAST_DUE
        db.add(subscription)
        db.commit()
        logger.info(f"Marked subscription as past due: {subscription.id}")
