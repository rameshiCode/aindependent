from typing import Optional
import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr
from sqlmodel import JSON, Column, Field, Relationship, SQLModel, String


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

    conversations: list["Conversation"] = Relationship(
        back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Generic message
class GenericMessage(SQLModel):
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


# Add to models.py
class PaymentIntentCreate(BaseModel):
    price_id: str
    customer_id: str | None = None
    setup_future_usage: str | None = "off_session"  # For saving payment method
    metadata: dict | None = None


class PaymentIntentResponse(BaseModel):
    client_secret: str
    ephemeral_key: str
    customer_id: str
    publishable_key: str


# Conversation model
class Conversation(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    title: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: User = Relationship(back_populates="conversations")
    messages: list["Message"] = Relationship(
        back_populates="conversation",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


# Message model
class Message(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    conversation_id: uuid.UUID = Field(foreign_key="conversation.id", index=True)
    role: str  # "system", "user", or "assistant"
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    conversation: Conversation | None = Relationship(back_populates="messages")


# Pydantic models for API requests/responses
class MessageSchema(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(SQLModel):
    messages: list[MessageSchema]
    model: str = "gpt-4o"
    temperature: float = 0.7
    max_tokens: int = 1000
    stream: bool = False


class ChatCompletionResponse(BaseModel):
    message: MessageSchema
    usage: dict[str, int]


class ConversationCreate(BaseModel):
    title: str = "New Conversation"


class ConversationWithMessages(SQLModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[MessageSchema]


# class WebhookEvent(SQLModel):
#     id: str
#     type: str
#     data: dict

# user profiling push notification
# Add to app/models.py


# User Profile model
class UserProfile(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", unique=True, index=True)
    therapist_gender: str | None = None
    addiction_type: str | None = None
    abstinence_days: int = 0
    abstinence_start_date: datetime | None = None
    relapse_risk_score: int | None = None
    motivation_level: int | None = None
    big_five_scores: dict | None = Field(default=None, sa_column=Column(JSON))
    last_updated: datetime = Field(default_factory=datetime.utcnow)

    # Relationship
    user: User = Relationship(back_populates="profile")
    insights: list["UserInsight"] = Relationship(back_populates="profile")


# User Insight model
class UserInsight(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    profile_id: uuid.UUID = Field(foreign_key="userprofile.id", index=True)
    conversation_id: uuid.UUID | None = Field(
        default=None, foreign_key="conversation.id", index=True
    )
    insight_type: str  # 'trigger', 'coping_strategy', 'motivation', etc.
    value: str
    day_of_week: str | None = None  # For schedule-related insights
    time_of_day: str | None = None  # For schedule-related insights
    emotional_significance: float | None = None
    confidence: float = 0.0
    extracted_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    profile: UserProfile = Relationship(back_populates="insights")
    user: User = Relationship()
    conversation: Conversation | None = Relationship()


# User Goal model
class UserGoal(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    description: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    target_date: datetime | None = None
    status: str = "active"  # 'active', 'completed', 'abandoned'
    last_notification_sent: datetime | None = None

    # Relationship
    user: User = Relationship()


# Notification model
class UserNotification(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    title: str
    body: str
    notification_type: str  # 'goal_reminder', 'risk_event', 'abstinence_milestone'
    created_at: datetime = Field(default_factory=datetime.utcnow)
    scheduled_for: datetime
    related_entity_id: uuid.UUID | None = None  # Could be insight_id or goal_id
    priority: int = 3  # 1-5 scale
    was_sent: bool = False
    was_opened: bool = False
    
    # Relationship
    user: User = Relationship()
    engagements: list["UserNotificationEngagement"] = Relationship(back_populates="notification")

class ScheduledNotification(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    notification_type: str  # Type of notification
    title: str  # Notification title
    body: str  # Notification body
    scheduled_for: datetime  # When to send the notification
    sent: bool = False  # Whether it has been sent
    related_entity_id: Optional[str] = None  # ID of related entity
    priority: int = 3  # Priority on a scale of 1-10
    metadata: Optional[str] = Field(default=None, sa_column=Column(JSON))  # JSON-serialized metadata

    # Relationship
    user: User = Relationship()

class UserNotificationSettings(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", unique=True, index=True)
    
    # Toggle settings for different notification types
    goal_reminders: bool = True
    abstinence_milestones: bool = True
    risk_alerts: bool = True
    daily_check_ins: bool = False
    coping_strategies: bool = True
    educational_content: bool = True
    
    # Quiet hours settings
    quiet_hours_enabled: bool = False
    quiet_hours_start: str = "22:00"  # HH:MM format
    quiet_hours_end: str = "08:00"    # HH:MM format
    
    # Preferred notification times
    preferred_time_morning: bool = True
    preferred_time_afternoon: bool = True
    preferred_time_evening: bool = True
    
    # Maximum notifications per day
    max_notifications_per_day: int = 5
    
    # Relationship
    user: User = Relationship()

class UserNotificationEngagement(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    notification_id: uuid.UUID = Field(foreign_key="usernotification.id", index=True)
    engaged: bool  # Whether the user engaged with notification
    engagement_time: datetime = Field(default_factory=datetime.utcnow)  # When engagement happened

    # Relationships
    user: "User" = Relationship()
    notification: UserNotification = Relationship()