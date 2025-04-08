import uuid
from datetime import datetime
from enum import Enum
from typing import Any

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
    profile: "UserProfile" = Relationship(back_populates="user")


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
    insights: list["UserInsight"] = Relationship(back_populates="conversation")


# Message model
class Message(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    conversation_id: uuid.UUID = Field(foreign_key="conversation.id", index=True)
    role: str  # "system", "user", or "assistant"
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    message_metadata: dict | None = Field(
        default=None, sa_column=Column(JSON)
    )  # Added for MI stage tracking

    # Relationships
    conversation: Conversation | None = Relationship(back_populates="messages")


# Pydantic models for API requests/responses
class MessageSchema(BaseModel):
    role: str
    content: str
    metadata: dict | None = None  # Added for MI stage tracking


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


# Addiction Type Enum
class AddictionType(str, Enum):
    ALCOHOL = "alcohol"
    DRUGS = "drugs"
    GAMBLING = "gambling"
    OTHER = "other"


# Recovery Stage Enum
class RecoveryStage(str, Enum):
    PRECONTEMPLATION = "precontemplation"
    CONTEMPLATION = "contemplation"
    PREPARATION = "preparation"
    ACTION = "action"
    MAINTENANCE = "maintenance"


# Motivational Interviewing Stage Enum
class MIStage(str, Enum):
    ENGAGING = "engaging"
    FOCUSING = "focusing"
    EVOKING = "evoking"
    PLANNING = "planning"


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
    recovery_stage: str | None = None  # Added for MI-based profiling
    psychological_traits: dict | None = Field(
        default=None, sa_column=Column(JSON)
    )  # Added for MI-based profiling
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
    insight_type: str  # 'trigger', 'coping_strategy', 'motivation', 'psychological_trait', etc.
    value: str
    day_of_week: str | None = None  # For schedule-related insights
    time_of_day: str | None = None  # For schedule-related insights
    emotional_significance: float | None = None
    confidence: float = 0.0
    extracted_at: datetime = Field(default_factory=datetime.utcnow)
    mi_stage: str | None = None  # Added for MI-based profiling

    # Relationships
    profile: UserProfile = Relationship(back_populates="insights")
    user: User = Relationship()
    conversation: Conversation | None = Relationship(back_populates="insights")


# User Goal model
class UserGoal(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    description: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    target_date: datetime | None = None
    status: str = "active"  # 'active', 'completed', 'abandoned'
    last_notification_sent: datetime | None = None
    mi_related: bool = False  # Added to track if goal was created through MI process

    # Relationship
    user: User = Relationship()


# Notification model
class UserNotification(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    title: str
    body: str
    notification_type: str  # 'goal_reminder', 'risk_event', 'abstinence_milestone'
    scheduled_for: datetime
    related_entity_id: uuid.UUID | None = None  # Could be insight_id or goal_id
    priority: int = 3  # 1-5 scale
    was_sent: bool = False
    was_opened: bool = False

    # Relationship
    user: User = Relationship()


# Profile Attribute model for API responses
class ProfileAttributeModel(BaseModel):
    value: Any
    confidence: float
    last_updated: datetime


# Comprehensive User Profile model for API responses
class UserProfileModel(BaseModel):
    user_id: str
    created_at: datetime
    last_updated: datetime

    # Core attributes
    addiction_type: ProfileAttributeModel | None = None
    addiction_severity: ProfileAttributeModel | None = None
    addiction_duration: ProfileAttributeModel | None = None
    previous_recovery_attempts: ProfileAttributeModel | None = None

    # Family relationships
    family_aware: ProfileAttributeModel | None = None
    family_support_level: ProfileAttributeModel | None = None
    family_communication: ProfileAttributeModel | None = None
    family_triggers: ProfileAttributeModel | None = None

    # Psychological traits
    need_for_approval: ProfileAttributeModel | None = None
    fear_of_rejection: ProfileAttributeModel | None = None
    low_self_confidence: ProfileAttributeModel | None = None
    submissiveness: ProfileAttributeModel | None = None

    # Behavioral patterns
    triggers: ProfileAttributeModel | None = None
    motivation_level: ProfileAttributeModel | None = None
    motivators: ProfileAttributeModel | None = None
    barriers: ProfileAttributeModel | None = None
    ambivalence_factors: ProfileAttributeModel | None = None

    # Recovery stage
    recovery_stage: ProfileAttributeModel | None = None

    # Coping mechanisms
    effective_strategies: ProfileAttributeModel | None = None
    ineffective_patterns: ProfileAttributeModel | None = None
    anxiety_management: ProfileAttributeModel | None = None
    relapse_prevention: ProfileAttributeModel | None = None

    # Contextual information
    abstinence_start_date: ProfileAttributeModel | None = None
    milestones: ProfileAttributeModel | None = None
    high_risk_events: ProfileAttributeModel | None = None
    regular_patterns: ProfileAttributeModel | None = None

    # Environmental factors
    living_situation: ProfileAttributeModel | None = None
    work_environment: ProfileAttributeModel | None = None
    social_circle: ProfileAttributeModel | None = None
    support_resources: ProfileAttributeModel | None = None

    # Keywords for notifications
    notification_keywords: ProfileAttributeModel | None = None


# API response models for profile data
class UserInsightResponse(BaseModel):
    id: str
    insight_type: str
    value: str
    confidence: float
    extracted_at: datetime
    mi_stage: str | None
    day_of_week: str | None
    time_of_day: str | None


class UserProfileResponse(BaseModel):
    id: str
    user_id: str
    addiction_type: str | None
    abstinence_days: int
    abstinence_start_date: datetime | None
    motivation_level: int | None
    recovery_stage: str | None
    psychological_traits: dict | None
    last_updated: datetime
