import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr
from sqlmodel import Column, Field, Relationship, SQLModel, String


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=40)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=40)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore
    password: str | None = Field(default=None, min_length=8, max_length=40)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=40)
    new_password: str = Field(min_length=8, max_length=40)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=40)


class UsageRecord(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id")
    count: int = 0
    last_request_at: datetime = Field(default_factory=datetime.utcnow)

    user: User = Relationship()


class CheckoutSessionCreate(BaseModel):
    price_id: str
    success_url: str  # Using str instead of HttpUrl for flexibility
    cancel_url: str


class PortalSessionCreate(BaseModel):
    return_url: str


# Subscription Status Enum
class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    PAST_DUE = "past_due"
    UNPAID = "unpaid"
    CANCELED = "canceled"
    INCOMPLETE = "incomplete"
    INCOMPLETE_EXPIRED = "incomplete_expired"
    TRIALING = "trialing"


# Plan Interval Enum
class PlanInterval(str, Enum):
    MONTH = "month"
    YEAR = "year"


# Plan model
class Plan(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True)
    description: str | None = None
    stripe_product_id: str = Field(unique=True)
    active: bool = True

    # Relationships
    prices: list["Price"] = Relationship(back_populates="plan")


# Price model
class Price(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    plan_id: uuid.UUID = Field(foreign_key="plan.id")
    stripe_price_id: str = Field(unique=True)
    interval: PlanInterval
    amount: int  # in cents
    currency: str = "usd"
    active: bool = True

    # Relationships
    plan: Plan = Relationship(back_populates="prices")
    subscriptions: list["Subscription"] = Relationship(back_populates="price")


# Customer model (extends User)
class Customer(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", unique=True)
    stripe_customer_id: str | None = Field(unique=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: User = Relationship()
    subscriptions: list["Subscription"] = Relationship(back_populates="customer")
    payment_methods: list["PaymentMethod"] = Relationship(back_populates="customer")


# Subscription model
class Subscription(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    customer_id: uuid.UUID = Field(foreign_key="customer.id")
    price_id: uuid.UUID = Field(foreign_key="price.id")
    stripe_subscription_id: str = Field(unique=True, index=True)
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool = False
    canceled_at: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    customer: Customer = Relationship(back_populates="subscriptions")
    price: Price = Relationship(back_populates="subscriptions")
    invoices: list["Invoice"] = Relationship(back_populates="subscription")


# Invoice model
class Invoice(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    subscription_id: uuid.UUID = Field(foreign_key="subscription.id")
    stripe_invoice_id: str = Field(unique=True, index=True)
    amount_paid: int  # in cents
    currency: str = "usd"
    status: str  # paid, open, void, uncollectible
    invoice_pdf: str | None = Field(default=None, sa_column=Column(String(2048)))
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    subscription: Subscription = Relationship(back_populates="invoices")


# Payment Method model
class PaymentMethod(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    customer_id: uuid.UUID = Field(foreign_key="customer.id")
    stripe_payment_method_id: str = Field(unique=True, index=True)
    type: str  # card, bank_account, etc.
    card_last4: str | None = None
    card_brand: str | None = None
    card_exp_month: int | None = None
    card_exp_year: int | None = None
    is_default: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    customer: Customer = Relationship(back_populates="payment_methods")


# class WebhookEvent(SQLModel):
#     id: str
#     type: str
#     data: dict
