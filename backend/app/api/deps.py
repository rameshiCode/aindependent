from collections.abc import Generator
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2AuthorizationCodeBearer, OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from sqlmodel import Session, select

from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.models import (
    Customer,
    Subscription,
    SubscriptionStatus,
    TokenPayload,
    UsageRecord,
    User,
)

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token"
)


google_oauth2 = OAuth2AuthorizationCodeBearer(
    authorizationUrl=settings.GOOGLE_AUTH_URL,
    tokenUrl=settings.GOOGLE_TOKEN_URL,
    scopes={
        "openid": "OpenID Connect scope",
        "email": "Access to your email",
        "profile": "Access to your profile",
    },
)


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(reusable_oauth2)]
GoogleDep = Annotated[str, Depends(google_oauth2)]


def get_current_user(session: SessionDep, token: TokenDep) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (InvalidTokenError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = session.get(User, token_data.sub)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_active_superuser(current_user: CurrentUser) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


SuperUserRequired = Depends(get_current_active_superuser)


def get_stripe_customer(session: SessionDep, current_user: CurrentUser) -> Customer:
    """Get or create Stripe customer for current user"""
    customer = session.exec(
        select(Customer).where(Customer.user_id == current_user.id)
    ).first()

    if not customer:
        raise HTTPException(
            status_code=404,
            detail="No payment profile found. Please set up your payment details first.",
        )

    return customer


StripeCustomerDep = Annotated[Customer, Depends(get_stripe_customer)]


def verify_active_subscription(session: SessionDep, current_user: CurrentUser) -> None:
    """Verify user has an active subscription or raise error"""
    result = session.exec(
        select(Subscription)
        .join(Customer)
        .where(
            Customer.user_id == current_user.id,
            Subscription.status == SubscriptionStatus.ACTIVE,
        )
    ).first()

    if not result:
        raise HTTPException(
            status_code=403, detail="Active subscription required for this feature"
        )


ActiveSubscriptionRequired = Depends(verify_active_subscription)

# Add these functions to the end of your existing deps.py file

FREE_REQUESTS_LIMIT = 6


def check_subscription_status(session: Session, user_id):
    """Check if user has an active subscription"""
    customer = session.exec(select(Customer).where(Customer.user_id == user_id)).first()

    if customer:
        # Check for active subscription
        subscription = session.exec(
            select(Subscription)
            .where(Subscription.customer_id == customer.id)
            .where(Subscription.status == SubscriptionStatus.ACTIVE)
        ).first()

        if subscription:
            return True

    return False


def check_usage_limits(
    current_user: User = Depends(get_current_active_user),
    session: Session = Depends(get_db),
):
    """
    Middleware to check if a user has reached their usage limits.
    """
    # If user has an active subscription, allow access
    if check_subscription_status(session, current_user.id):
        return current_user

    # Check request count for free tier users
    usage_record = session.exec(
        select(UsageRecord).where(UsageRecord.user_id == current_user.id)
    ).first()

    requests_used = usage_record.count if usage_record else 0

    # If over the limit, block access
    if requests_used >= FREE_REQUESTS_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "message": "Usage limit reached. Please subscribe to continue.",
                "requests_used": requests_used,
                "requests_limit": FREE_REQUESTS_LIMIT,
                "limit_reached": True,
            },
        )

    return current_user


# Create a dependency
UsageLimitCheck = Depends(check_usage_limits)
