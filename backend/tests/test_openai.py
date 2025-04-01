import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from sqlmodel import Session

from app.api.routes.openai import (
    call_openai_with_fallback,
    create_conversation,
    create_message,
    delete_conversation,
    get_conversation,
    get_conversations,
    update_conversation,
)
from app.models import (
    Conversation,
    ConversationCreate,
    Message,
    MessageSchema,
)

# ==================== FIXTURES ====================


@pytest.fixture
def mock_openai_client():
    """Mock the OpenAI client used in the module."""
    with patch("app.api.routes.openai.openai_client") as mock_client:
        yield mock_client


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    mock_session = MagicMock(spec=Session)

    # Configure the mock session's exec method to return a configurable result
    mock_session.exec.return_value = MagicMock()
    mock_session.exec.return_value.all.return_value = []
    mock_session.exec.return_value.first.return_value = None

    yield mock_session


@pytest.fixture
def mock_current_user():
    """Create a mock current user for testing."""
    mock_user = MagicMock()
    mock_user.id = uuid.uuid4()
    mock_user.email = "test@example.com"
    yield mock_user


@pytest.fixture
def sample_conversation(mock_current_user):
    """Create a sample conversation for testing."""
    return Conversation(
        id=uuid.uuid4(),
        user_id=mock_current_user.id,
        title="Test Conversation",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


@pytest.fixture
def sample_messages(sample_conversation):
    """Create sample messages for testing."""
    return [
        Message(
            id=uuid.uuid4(),
            conversation_id=sample_conversation.id,
            role="user",
            content="Hello, AI!",
            created_at=datetime.utcnow(),
        ),
        Message(
            id=uuid.uuid4(),
            conversation_id=sample_conversation.id,
            role="assistant",
            content="Hello, human! How can I help you today?",
            created_at=datetime.utcnow(),
        ),
    ]


# ==================== TESTS ====================


@pytest.mark.asyncio
async def test_call_openai_with_fallback_success(mock_openai_client):
    """Test successful OpenAI API call."""
    # Arrange
    mock_completion = MagicMock()
    mock_openai_client.chat.completions.create = AsyncMock(return_value=mock_completion)

    messages = [{"role": "user", "content": "Hello"}]

    # Act
    result = await call_openai_with_fallback(messages, "gpt-3.5-turbo")

    # Assert
    assert result == mock_completion
    mock_openai_client.chat.completions.create.assert_called_once_with(
        model="gpt-3.5-turbo",
        messages=messages,
    )


@pytest.mark.asyncio
async def test_call_openai_with_fallback_retry_success(mock_openai_client):
    """Test OpenAI API call with retry that eventually succeeds."""
    # Arrange
    mock_completion = MagicMock()

    # Create a side effect that fails twice then succeeds
    side_effect = [Exception("API error"), Exception("API error"), mock_completion]
    mock_openai_client.chat.completions.create = AsyncMock(side_effect=side_effect)

    messages = [{"role": "user", "content": "Hello"}]

    # Act
    with patch("app.api.routes.openai.asyncio.sleep", AsyncMock()) as mock_sleep:
        result = await call_openai_with_fallback(messages, "gpt-3.5-turbo")

    # Assert
    assert result == mock_completion
    assert mock_openai_client.chat.completions.create.call_count == 3
    # Check that sleep was called for the retries
    assert mock_sleep.call_count == 2


@pytest.mark.asyncio
async def test_call_openai_with_fallback_model_fallback(mock_openai_client):
    """Test OpenAI API call with model fallback when primary model fails."""
    # Arrange
    mock_completion = MagicMock()

    # Set up side effects to fail with first model but succeed with second
    def side_effect_func(model, **kwargs):
        if model == "gpt-4":
            raise Exception("Model not available")
        return mock_completion

    mock_openai_client.chat.completions.create = AsyncMock(
        side_effect=lambda **kwargs: side_effect_func(**kwargs)
    )

    messages = [{"role": "user", "content": "Hello"}]

    # Act
    with patch("app.api.routes.openai.MODELS_TO_TRY", ["gpt-4", "gpt-3.5-turbo"]):
        with patch("app.api.routes.openai.asyncio.sleep", AsyncMock()):
            result = await call_openai_with_fallback(messages, "gpt-4")

    # Assert
    assert result == mock_completion


@pytest.mark.asyncio
async def test_call_openai_with_fallback_all_models_fail(mock_openai_client):
    """Test OpenAI API call when all models fail."""
    # Arrange
    mock_openai_client.chat.completions.create = AsyncMock(
        side_effect=Exception("API error")
    )

    messages = [{"role": "user", "content": "Hello"}]

    # Act & Assert
    with patch("app.api.routes.openai.MODELS_TO_TRY", ["model1", "model2"]):
        with patch("app.api.routes.openai.asyncio.sleep", AsyncMock()):
            with pytest.raises(Exception, match="API error"):
                await call_openai_with_fallback(messages, "model1")


@pytest.mark.asyncio
async def test_create_conversation(mock_session, mock_current_user):
    """Test creating a new conversation."""
    # Arrange
    conversation_create = ConversationCreate(title="New Conversation")

    # Act
    result = await create_conversation(
        conversation_create, mock_session, mock_current_user
    )

    # Assert
    assert result.title == "New Conversation"
    mock_session.add.assert_called_once()
    mock_session.commit.assert_called_once()
    mock_session.refresh.assert_called_once()


@pytest.mark.asyncio
async def test_get_conversations_empty(mock_session, mock_current_user):
    """Test getting conversations when none exist."""
    # Arrange - using default mock_session behavior (empty list)

    # Act
    result = await get_conversations(mock_session, mock_current_user)

    # Assert
    assert result == []
    mock_session.exec.assert_called_once()


@pytest.mark.asyncio
async def test_get_conversations_with_data(
    mock_session, mock_current_user, sample_conversation, sample_messages
):
    """Test getting conversations with existing data."""
    # Arrange
    # First query returns conversations, second query returns messages
    mock_session.exec.side_effect = None  # Reset any previous side_effects

    # Set up the first call to return conversations
    first_result = MagicMock()
    first_result.all.return_value = [sample_conversation]

    # Set up the second call to return messages for each conversation
    second_result = MagicMock()
    second_result.all.return_value = sample_messages

    # Configure the side effect to return different results based on call sequence
    mock_session.exec.side_effect = [first_result, second_result]

    # Act
    result = await get_conversations(mock_session, mock_current_user)

    # Assert
    assert len(result) == 1
    assert result[0].id == sample_conversation.id
    assert result[0].title == sample_conversation.title
    assert len(result[0].messages) == 2  # This should now pass


@pytest.mark.asyncio
async def test_get_conversation_not_found(mock_session, mock_current_user):
    """Test getting a conversation that doesn't exist."""
    # Arrange
    conversation_id = uuid.uuid4()

    # Act & Assert
    with pytest.raises(HTTPException) as exc_info:
        await get_conversation(conversation_id, mock_session, mock_current_user)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Conversation not found"


@pytest.mark.asyncio
async def test_get_conversation_success(
    mock_session, mock_current_user, sample_conversation, sample_messages
):
    """Test successfully getting a conversation."""
    # Arrange
    conversation_id = sample_conversation.id

    # First query returns the conversation
    first_result = MagicMock()
    first_result.first.return_value = sample_conversation

    # Second query returns the messages
    second_result = MagicMock()
    second_result.all.return_value = sample_messages

    # Set up a sequence of mock returns
    mock_session.exec.side_effect = [first_result, second_result]

    # Act
    result = await get_conversation(conversation_id, mock_session, mock_current_user)

    # Assert
    assert result.id == sample_conversation.id
    assert result.title == sample_conversation.title
    assert len(result.messages) == 2


@pytest.mark.asyncio
async def test_create_message(
    mock_session,
    mock_current_user,
    mock_openai_client,
    sample_conversation,
    sample_messages,
):
    """Test creating a message and getting an OpenAI response."""
    # Arrange
    conversation_id = sample_conversation.id
    message = MessageSchema(role="user", content="Test message")

    # First query returns the conversation
    first_result = MagicMock()
    first_result.first.return_value = sample_conversation

    # Second query returns conversation history
    second_result = MagicMock()
    second_result.all.return_value = sample_messages

    # Set up the query results
    mock_session.exec.side_effect = [first_result, second_result]

    # Set up OpenAI client mock
    completion_mock = MagicMock()
    completion_mock.choices = [MagicMock()]
    completion_mock.choices[0].message.content = "OpenAI response"

    # Use patch to mock the openai_client check and call_openai_with_fallback function
    with patch("app.api.routes.openai.openai_client", mock_openai_client):
        with patch(
            "app.api.routes.openai.call_openai_with_fallback",
            AsyncMock(return_value=completion_mock),
        ):
            # Act
            result = await create_message(
                message, conversation_id, mock_current_user, mock_session
            )

    # Assert
    assert result.role == "assistant"
    assert result.content == "OpenAI response"
    assert mock_session.add.call_count == 2  # Once for user message, once for assistant
    assert mock_session.commit.call_count == 1


@pytest.mark.asyncio
async def test_create_message_conversation_not_found(mock_session, mock_current_user):
    """Test creating a message when the conversation doesn't exist."""
    # Arrange
    conversation_id = uuid.uuid4()
    message = MessageSchema(role="user", content="Test message")

    # Configure mock to return None for conversation
    mock_session.exec.return_value.first.return_value = None

    # Act & Assert
    with pytest.raises(HTTPException) as exc_info:
        await create_message(message, conversation_id, mock_current_user, mock_session)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Conversation not found"


@pytest.mark.asyncio
async def test_update_conversation(
    mock_session, mock_current_user, sample_conversation
):
    """Test updating a conversation title."""
    # Arrange
    conversation_id = sample_conversation.id
    new_title = "Updated Title"

    # Configure mock to return the conversation
    mock_result = MagicMock()
    mock_result.first.return_value = sample_conversation
    mock_session.exec.return_value = mock_result

    # Act
    result = await update_conversation(
        conversation_id, new_title, mock_session, mock_current_user
    )

    # Assert
    assert result.title == new_title
    mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_update_conversation_not_found(mock_session, mock_current_user):
    """Test updating a conversation that doesn't exist."""
    # Arrange
    conversation_id = uuid.uuid4()
    new_title = "Updated Title"

    # Configure mock to return None for conversation
    mock_session.exec.return_value.first.return_value = None

    # Act & Assert
    with pytest.raises(HTTPException) as exc_info:
        await update_conversation(
            conversation_id, new_title, mock_session, mock_current_user
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Conversation not found"


@pytest.mark.asyncio
async def test_delete_conversation(
    mock_session, mock_current_user, sample_conversation, sample_messages
):
    """Test deleting a conversation."""
    # Arrange
    conversation_id = sample_conversation.id

    # First query returns the conversation
    first_result = MagicMock()
    first_result.first.return_value = sample_conversation

    # Second query returns the messages
    second_result = MagicMock()
    second_result.all.return_value = sample_messages

    # Configure the mock
    mock_session.exec.side_effect = [first_result, second_result]

    # Act
    await delete_conversation(conversation_id, mock_session, mock_current_user)

    # Assert
    assert (
        mock_session.delete.call_count == 3
    )  # Once for conversation, twice for messages
    mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_delete_conversation_not_found(mock_session, mock_current_user):
    """Test deleting a conversation that doesn't exist."""
    # Arrange
    conversation_id = uuid.uuid4()

    # Configure mock to return None for conversation
    mock_session.exec.return_value.first.return_value = None

    # Act & Assert
    with pytest.raises(HTTPException) as exc_info:
        await delete_conversation(conversation_id, mock_session, mock_current_user)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Conversation not found"


@pytest.mark.asyncio
async def test_delete_conversation_with_no_messages(
    mock_session, mock_current_user, sample_conversation
):
    """Test deleting a conversation that has no messages."""
    # Arrange
    conversation_id = sample_conversation.id

    # First query returns the conversation
    first_result = MagicMock()
    first_result.first.return_value = sample_conversation

    # Second query returns no messages
    second_result = MagicMock()
    second_result.all.return_value = []

    # Configure the mock
    mock_session.exec.side_effect = [first_result, second_result]

    # Act
    await delete_conversation(conversation_id, mock_session, mock_current_user)

    # Assert
    assert mock_session.delete.call_count == 1  # Only conversation deleted
    mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_get_conversations_with_empty_messages(
    mock_session, mock_current_user, sample_conversation
):
    """Test getting conversations with no messages."""
    # Arrange
    # First query returns conversations
    first_result = MagicMock()
    first_result.all.return_value = [sample_conversation]

    # Second query returns no messages
    second_result = MagicMock()
    second_result.all.return_value = []

    # Configure the mock
    mock_session.exec.side_effect = [first_result, second_result]

    # Act
    result = await get_conversations(mock_session, mock_current_user)

    # Assert
    assert len(result) == 1
    assert result[0].id == sample_conversation.id
    assert result[0].title == sample_conversation.title
    assert len(result[0].messages) == 0


@pytest.mark.asyncio
async def test_create_message_with_empty_content(
    mock_session, mock_current_user, mock_openai_client, sample_conversation
):
    """Test creating a message with empty content."""
    # Arrange
    conversation_id = sample_conversation.id
    message = MessageSchema(role="user", content="")

    # First query returns the conversation
    first_result = MagicMock()
    first_result.first.return_value = sample_conversation

    # Second query returns conversation history
    second_result = MagicMock()
    second_result.all.return_value = []

    # Set up the query results
    mock_session.exec.side_effect = [first_result, second_result]

    # Set up OpenAI client mock to appear "truthy"
    mock_openai_client.__bool__ = lambda self: True  # <-- Add this
    mock_openai_client.chat.completions.create = AsyncMock()  # <-- Add this

    completion_mock = MagicMock()
    completion_mock.choices = [MagicMock()]
    completion_mock.choices[
        0
    ].message.content = "I notice your message was empty. How can I help you?"

    # Patch both the client and the API call
    with patch("app.api.routes.openai.openai_client", mock_openai_client):
        with patch(
            "app.api.routes.openai.call_openai_with_fallback",
            AsyncMock(return_value=completion_mock),
        ):
            # Act
            result = await create_message(
                message, conversation_id, mock_current_user, mock_session
            )

    # Assert
    assert result.role == "assistant"
    assert "empty" in result.content.lower()
    assert mock_session.add.call_count == 2
    assert mock_session.commit.call_count == 1
