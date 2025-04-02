import asyncio
import logging
import os
import traceback
import uuid
from datetime import datetime

import httpx
from fastapi import APIRouter, HTTPException, status
from openai import AsyncOpenAI
from sqlmodel import select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Conversation,
    ConversationCreate,
    ConversationWithMessages,
    Message,
    MessageSchema,
)

router = APIRouter(prefix="/openai", tags=["openai"])

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Try loading .env file if available
try:
    from dotenv import load_dotenv

    logger.info("Attempting to load .env file explicitly...")
    load_dotenv()
    logger.info("dotenv.load_dotenv() called")
except ImportError:
    logger.warning("python-dotenv not installed, skipping explicit .env loading")

# Environment variable debugging (keeping this as requested)
logger.info("=================== OPENAI CONFIG DEBUG ===================")
logger.info(f"Current working directory: {os.getcwd()}")
logger.info(f"Environment variable count: {len(os.environ)}")

# Check all possible env var names for OpenAI
possible_key_names = [
    "OPENAI_API_KEY",
    "OPENAI_KEY",
    "OPENAI_SECRET_KEY",
    "OPENAI_TOKEN",
    "openai_api_key",
]

# Show environment variables for debugging
all_env_keys = list(os.environ.keys())
logger.info(f"All environment variable names: {all_env_keys}")
openai_related_keys = [k for k in all_env_keys if "openai" in k.lower()]
logger.info(f"OpenAI-related keys found: {openai_related_keys}")

# Get API key
api_key = None
for key_name in possible_key_names:
    value = os.environ.get(key_name)
    if value:
        logger.info(f"✅ Found key using name: {key_name}")
        api_key = value
        break

if not api_key:
    logger.error("❌ OpenAI API key not found in any expected variable names!")
    # Check .env files
    env_paths = [".env", "/.env", "../.env", "../../.env", "/app/.env"]
    for path in env_paths:
        if os.path.exists(path):
            logger.info(f"Found .env file at: {path}")
            with open(path) as f:
                content = f.read().strip()
                if "OPENAI_API_KEY" in content:
                    logger.info("✅ .env file contains OPENAI_API_KEY")
                else:
                    logger.error("❌ .env file doesn't contain OPENAI_API_KEY")
        else:
            logger.info(f"No .env file at {path}")
else:
    # Safely log key info without revealing the full key
    key_length = len(api_key) if api_key else 0
    key_prefix = api_key[:4] + "..." if api_key and len(api_key) > 4 else ""
    logger.info(f"✅ OpenAI API key found: length={key_length}, prefix={key_prefix}")

# Direct API key test
logger.info(
    f"Direct API key test: {'✅ Found (length: ' + str(len(api_key)) + ')' if api_key else '❌ Not found'}"
)

# Initialize client with custom settings
openai_client = None
try:
    if api_key:
        # Create custom HTTP client with improved settings
        http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=10.0, read=30.0, write=30.0, pool=30.0),
            verify=True,  # Set to False only for testing in restricted environments
        )
        openai_client = AsyncOpenAI(api_key=api_key, http_client=http_client)
        logger.info("✅ OpenAI client initialized successfully")
    else:
        logger.error("Cannot initialize OpenAI client without API key")
except Exception as e:
    logger.error(f"❌ Failed to initialize OpenAI client: {str(e)}")
    logger.exception("Detailed exception:")

logger.info("======== OPENAI CLIENT SETUP COMPLETE ========")

# Models to try in order of preference (fallback mechanism)
MODELS_TO_TRY = [
    "gpt-3.5-turbo",  # Most reliable model
    "gpt-4",  # Alternative if available
    "gpt-4o",  # Try this last as it might be blocked in some environments
]


async def call_openai_with_fallback(
    messages, requested_model="gpt-3.5-turbo", max_retries=3
):
    """Call OpenAI API with model fallback and retry logic"""
    # Start with the requested model, then try fallbacks
    models_to_try = [requested_model]

    # Add other models from MODELS_TO_TRY if they're not already included
    for model in MODELS_TO_TRY:
        if model not in models_to_try:
            models_to_try.append(model)

    last_error = None

    for model in models_to_try:
        retries = 0
        while retries < max_retries:
            try:
                logger.info(
                    f"Calling OpenAI API with model: {model} (attempt {retries+1}/{max_retries})"
                )
                completion = await openai_client.chat.completions.create(
                    model=model,
                    messages=messages,
                )
                logger.info(f"OpenAI API call successful with model: {model}")
                return completion
            except Exception as e:
                retries += 1
                logger.warning(
                    f"OpenAI API call failed with model {model} (attempt {retries}/{max_retries}): {str(e)}"
                )

                if retries >= max_retries:
                    logger.error(
                        f"Max retries reached for model {model}. Last error: {str(e)}"
                    )
                    last_error = e
                    break  # Try next model

                # Add exponential backoff before retrying
                delay = 1 * (2 ** (retries - 1))  # 1, 2, 4 seconds
                logger.info(f"Retrying in {delay} seconds...")
                await asyncio.sleep(delay)

    # If all models fail, raise the last error
    logger.error("All models failed, raising last error")
    raise (
        last_error
        if last_error
        else RuntimeError("Failed to call OpenAI API with all models")
    )


# API Endpoints


@router.post("/conversations", response_model=ConversationWithMessages)
async def create_conversation(
    conversation: ConversationCreate, session: SessionDep, current_user: CurrentUser
):
    """Create a new conversation"""
    new_conversation = Conversation(
        id=uuid.uuid4(),
        user_id=current_user.id,
        title=conversation.title,
    )

    session.add(new_conversation)
    session.commit()
    session.refresh(new_conversation)

    return ConversationWithMessages(
        id=new_conversation.id,
        title=new_conversation.title,
        created_at=new_conversation.created_at,
        updated_at=new_conversation.updated_at,
        messages=[],
    )


@router.get("/conversations", response_model=list[ConversationWithMessages])
async def get_conversations(session: SessionDep, current_user: CurrentUser):
    """Get all conversations for the current user"""
    conversations = session.exec(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
    ).all()

    result = []
    for conv in conversations:
        messages = session.exec(
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(Message.created_at)
        ).all()

        result.append(
            ConversationWithMessages(
                id=conv.id,
                title=conv.title,
                created_at=conv.created_at,
                updated_at=conv.updated_at,
                messages=[
                    MessageSchema(role=msg.role, content=msg.content)
                    for msg in messages
                ],
            )
        )

    return result


@router.get("/conversations/{conversation_id}", response_model=ConversationWithMessages)
async def get_conversation(
    conversation_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
):
    """Get a specific conversation with messages"""
    conversation = session.exec(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(Conversation.user_id == current_user.id)
    ).first()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
        )

    messages = session.exec(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    ).all()

    return ConversationWithMessages(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=[
            MessageSchema(role=msg.role, content=msg.content) for msg in messages
        ],
    )


@router.post("/conversations/{conversation_id}/messages", response_model=MessageSchema)
async def create_message(
    message: MessageSchema,
    conversation_id: uuid.UUID,
    current_user: CurrentUser,
    session: SessionDep,
) -> MessageSchema:
    """Create a new message and get a response from OpenAI"""
    global openai_client  # Add this line
    try:
        # Verify conversation exists and belongs to user
        conversation = session.exec(
            select(Conversation)
            .where(Conversation.id == conversation_id)
            .where(Conversation.user_id == current_user.id)
        ).first()

        if not conversation:
            logger.error(
                f"Conversation {conversation_id} not found or doesn't belong to user {current_user.id}"
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
            )

        # Verify OpenAI client is initialized
        if not openai_client:
            if not api_key:
                logger.error("OpenAI API key not configured")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="OpenAI API key not configured",
                )

            # This should not happen but providing a fallback just in case
            # This should not happen but providing a fallback just in case
            try:
                logger.info("Re-initializing OpenAI client")
                http_client = httpx.AsyncClient(
                    timeout=httpx.Timeout(
                        connect=10.0, read=30.0, write=30.0, pool=30.0
                    ),
                    verify=True,
                )
                openai_client = AsyncOpenAI(api_key=api_key, http_client=http_client)
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI client: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to initialize OpenAI client",
                )

        # Save user message to database
        db_message = Message(
            conversation_id=conversation_id,
            role=message.role,
            content=message.content,
        )
        session.add(db_message)
        session.commit()

        # Get conversation history
        history = session.exec(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at)
        ).all()

        messages_for_api = [
            {"role": msg.role, "content": msg.content} for msg in history
        ]

        # Add system message if not present
        if not any(msg["role"] == "system" for msg in messages_for_api):
            messages_for_api.insert(
                0, {"role": "system", "content": "You are a helpful assistant."}
            )

        logger.info(f"Sending {len(messages_for_api)} messages to OpenAI API")

        # Call OpenAI API with fallback mechanism
        completion = await call_openai_with_fallback(
            messages_for_api,
            requested_model="gpt-3.5-turbo",
            max_retries=3,
        )

        # Extract assistant message
        assistant_message = completion.choices[0].message.content

        # Save assistant response to database
        db_assistant_message = Message(
            conversation_id=conversation_id,
            role="assistant",
            content=assistant_message,
        )
        session.add(db_assistant_message)

        # Update conversation timestamp
        conversation.updated_at = datetime.utcnow()
        session.commit()

        # Return assistant message
        return MessageSchema(role="assistant", content=assistant_message)

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Log unexpected errors
        logger.error(f"Unexpected error: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}",
        )


@router.put("/conversations/{conversation_id}", response_model=ConversationWithMessages)
async def update_conversation(
    conversation_id: uuid.UUID,
    title: str,
    session: SessionDep,
    current_user: CurrentUser,
):
    """Update conversation title"""
    conversation = session.exec(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(Conversation.user_id == current_user.id)
    ).first()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
        )

    conversation.title = title
    conversation.updated_at = datetime.utcnow()
    session.commit()

    messages = session.exec(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    ).all()

    return ConversationWithMessages(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=[
            MessageSchema(role=msg.role, content=msg.content) for msg in messages
        ],
    )


@router.delete(
    "/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_conversation(
    conversation_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
):
    """Delete a conversation and all its messages"""
    conversation = session.exec(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(Conversation.user_id == current_user.id)
    ).first()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
        )

    # Delete associated messages first
    messages = session.exec(
        select(Message).where(Message.conversation_id == conversation_id)
    ).all()

    for message in messages:
        session.delete(message)

    # Delete the conversation
    session.delete(conversation)
    session.commit()
