import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from passlib.context import CryptContext
from sqlmodel import Session, SQLModel, create_engine

from app.core.security import create_access_token
from app.models import User

# Create in-memory SQLite database for testing
TEST_SQLITE_URL = "sqlite:///:memory:"
engine = create_engine(TEST_SQLITE_URL)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@pytest.fixture(scope="function")
def db():
    """Create a fresh database for each test function"""
    # Create tables
    SQLModel.metadata.create_all(engine)

    # Provide session
    with Session(engine) as session:
        yield session

    # Drop all tables after test completes - ensures clean state for next test
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)


@pytest.fixture
def client():
    """Test client with Stripe routes properly registered"""
    from fastapi import FastAPI

    from app.api.routes import stripe

    # Create a test-specific FastAPI app instance
    test_app = FastAPI()

    # Register the Stripe router explicitly for tests
    test_app.include_router(
        stripe.router,
        prefix="/stripe",  # No /api prefix for simplicity in tests
        tags=["stripe"],
    )

    # Return a test client using this app
    with TestClient(test_app) as c:
        yield c


@pytest.fixture
def test_user(db: Session):
    """Create a test user for authentication"""
    # Generate unique email for each test run
    unique_id = uuid.uuid4().hex[:8]
    email = f"test_{unique_id}@example.com"

    user = User(
        id=uuid.uuid4(),
        email=email,
        hashed_password=pwd_context.hash("testpassword"),
        is_active=True,
        is_superuser=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def normal_user_token_headers(test_user):
    """Create auth headers with JWT token for the test user"""
    # Check the signature of create_access_token in your app and adjust parameters accordingly
    # This is based on the error message showing 'data' is not a valid parameter
    access_token = create_access_token(
        subject=test_user.email,  # Changed from 'data' to 'subject'
        expires_delta=timedelta(minutes=30),
    )
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def superuser(db: Session):
    """Create a superuser for admin operations"""
    # Generate unique email for each test run
    unique_id = uuid.uuid4().hex[:8]
    email = f"admin_{unique_id}@example.com"

    superuser = User(
        id=uuid.uuid4(),
        email=email,
        hashed_password=pwd_context.hash("adminpassword"),
        is_active=True,
        is_superuser=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(superuser)
    db.commit()
    db.refresh(superuser)
    return superuser


@pytest.fixture
def superuser_token_headers(superuser):
    """Create auth headers with JWT token for the superuser"""
    access_token = create_access_token(
        subject=superuser.email,  # Changed from 'data' to 'subject'
        expires_delta=timedelta(minutes=30),
    )
    return {"Authorization": f"Bearer {access_token}"}
