import logging
import os
import sys
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from sqlmodel import select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    Conversation,
    ConversationCreate,
    ConversationWithMessages,
    Message,
    MessageSchema,
)

router = APIRouter(prefix="/openai", tags=["openai"])

# Enhanced logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Extra debugging: Check .env loading
try:
    from dotenv import load_dotenv

    logger.info("Attempting to load .env file explicitly...")
    load_dotenv()
    logger.info("dotenv.load_dotenv() called")
except ImportError:
    logger.warning("python-dotenv not installed, skipping explicit .env loading")

# More detailed environment variable debugging
logger.info("=================== OPENAI CONFIG DEBUG ===================")
logger.info(f"Python version: {sys.version}")
logger.info(f"Current working directory: {os.getcwd()}")
logger.info(f"Environment variable count: {len(os.environ)}")

# Check all possible env var names for OpenAI
possible_key_names = [
    "OPENAI_API_KEY",
    "OPENAI_KEY",
    "OPENAI_SECRET_KEY",
    "OPENAI_TOKEN",
    "openai_api_key",  # Try lowercase too
]

# Show ALL environment variables for debugging (careful with security!)
all_env_keys = list(os.environ.keys())
logger.info(f"All environment variable names: {all_env_keys}")

# Check for any OpenAI-related keys
openai_related_keys = [k for k in all_env_keys if "openai" in k.lower()]
logger.info(f"OpenAI-related keys found: {openai_related_keys}")

# Try different methods to get the API key
api_key = None
for key_name in possible_key_names:
    # Try both methods of accessing env vars
    value = os.environ.get(key_name)
    if value:
        logger.info(f"✅ Found key using name: {key_name}")
        api_key = value
        break

if not api_key:
    logger.error("❌ OpenAI API key not found in any expected variable names!")

    # Check .env files
    env_paths = [".env", "/.env", "../.env", "../..//.env", "/app/.env"]
    for path in env_paths:
        if os.path.exists(path):
            logger.info(f"Found .env file at: {path}")
            with open(path) as f:
                content = f.read().strip()
                if "OPENAI_API_KEY" in content:
                    logger.info("✅ .env file contains OPENAI_API_KEY")
                    # DO NOT log the actual key content
                else:
                    logger.error("❌ .env file doesn't contain OPENAI_API_KEY")
        else:
            logger.info(f"No .env file at {path}")
else:
    # Safely log key info without revealing the full key
    key_length = len(api_key) if api_key else 0
    key_prefix = api_key[:4] + "..." if api_key and len(api_key) > 4 else ""
    logger.info(f"✅ OpenAI API key found: length={key_length}, prefix={key_prefix}")

# Add this near the beginning of your openai.py file
api_key = os.environ.get("OPENAI_API_KEY")
logger.info(
    f"Direct API key test: {'✅ Found (length: ' + str(len(api_key)) + ')' if api_key else '❌ Not found'}"
)

# Initialize client with additional logging
try:
    logger.info("Initializing OpenAI client...")
    if not api_key:
        logger.error("Cannot initialize OpenAI client without API key")
    else:
        openai_client = AsyncOpenAI(api_key=api_key)
        logger.info("✅ OpenAI client initialized successfully")
except Exception as e:
    logger.error(f"❌ Failed to initialize OpenAI client: {str(e)}")
    logger.exception("Detailed exception:")

logger.info("======== OPENAI CLIENT SETUP COMPLETE ========")


# Helper functions for OpenAI API
async def create_chat_completion(
    request: ChatCompletionRequest,
) -> ChatCompletionResponse:
    """Generate a chat completion response (non-streaming)"""
    try:
        messages = [
            {"role": msg.role, "content": msg.content} for msg in request.messages
        ]

        response = await openai_client.chat.completions.create(
            model=request.model,
            messages=messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            stream=False,
        )

        # Extract the response message
        message = MessageSchema(
            role="assistant", content=response.choices[0].message.content
        )

        # Extract token usage
        usage = {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens,
        }

        return ChatCompletionResponse(message=message, usage=usage)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OpenAI API error: {str(e)}",
        )


async def create_chat_completion_stream(
    request: ChatCompletionRequest,
) -> AsyncGenerator[str, None]:
    """Generate a streaming chat completion response"""
    try:
        messages = [
            {"role": msg.role, "content": msg.content} for msg in request.messages
        ]

        stream = await openai_client.chat.completions.create(
            model=request.model,
            messages=messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            stream=True,
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OpenAI API error: {str(e)}",
        )


# API Endpoints


# Create a new conversation
@router.post("/conversations", response_model=ConversationWithMessages)
async def create_conversation(
    conversation: ConversationCreate, session: SessionDep, current_user: CurrentUser
):
    new_conversation = Conversation(
        id=uuid.uuid4(),  # UUID object, not string
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


# Get all conversations for the current user
@router.get("/conversations", response_model=list[ConversationWithMessages])
async def get_conversations(session: SessionDep, current_user: CurrentUser):
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


# Get a specific conversation with messages
@router.get("/conversations/{conversation_id}", response_model=ConversationWithMessages)
async def get_conversation(
    conversation_id: uuid.UUID,  # Changed from str to uuid.UUID
    session: SessionDep,
    current_user: CurrentUser,
):
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


# Send a message and get a completion
@router.post("/conversations/{conversation_id}/messages", response_model=MessageSchema)
async def send_message(
    conversation_id: str,
    message: MessageSchema,
    session: SessionDep,
    current_user: CurrentUser,
):
    # Verify conversation exists and belongs to user
    conversation = session.exec(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(Conversation.user_id == current_user.id)
    ).first()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
        )

    # Save user message to database
    db_message = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        role=message.role,
        content=message.content,
    )
    session.add(db_message)

    # Get conversation history
    messages = session.exec(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    ).all()

    # Add system message for therapy context if it's the first message
    chat_messages = [
        MessageSchema(role=msg.role, content=msg.content) for msg in messages
    ]
    if not any(msg.role == "system" for msg in chat_messages):
        system_message = MessageSchema(
            role="system",
            content="You are a therapy assistant specializing in motivational interviewing. "
            "Your goal is to help users explore and resolve ambivalence about behavior change. "
            "Use open-ended questions, affirmations, reflective listening, and summaries. "
            "Be empathetic, non-judgmental, and focus on eliciting the user's own motivations for change.",
        )
        chat_messages.insert(0, system_message)

    # Get completion from OpenAI
    request = ChatCompletionRequest(messages=chat_messages)
    response = await create_chat_completion(request)

    # Save assistant response to database
    assistant_message = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        role="assistant",
        content=response.message.content,
    )
    session.add(assistant_message)

    # Update conversation timestamp
    conversation.updated_at = datetime.utcnow()
    session.add(conversation)

    session.commit()

    return response.message


# Stream a message completion
@router.post("/conversations/{conversation_id}/messages/stream")
async def stream_message(
    conversation_id: uuid.UUID,  # Changed from str to uuid.UUID
    message: MessageSchema,
    session: SessionDep,
    current_user: CurrentUser,
):
    # Verify conversation exists and belongs to user
    conversation = session.exec(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .where(Conversation.user_id == current_user.id)
    ).first()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
        )

    # Save user message to database
    db_message = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        role=message.role,
        content=message.content,
    )
    session.add(db_message)
    session.commit()

    # Get conversation history
    messages = session.exec(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    ).all()

    # Add system message for therapy context if it's the first message
    chat_messages = [
        MessageSchema(role=msg.role, content=msg.content) for msg in messages
    ]
    if not any(msg.role == "system" for msg in chat_messages):
        system_message = MessageSchema(
            role="system",
            content="You are a therapy assistant specializing in motivational interviewing. "
            "Your goal is to help users explore and resolve ambivalence about behavior change. "
            "Use open-ended questions, affirmations, reflective listening, and summaries. "
            "Be empathetic, non-judgmental, and focus on eliciting the user's own motivations for change.",
        )
        chat_messages.insert(0, system_message)

    # Create streaming request
    request = ChatCompletionRequest(messages=chat_messages, stream=True)

    # This will collect the full response to save to the database
    full_response = []

    async def response_generator():
        async for text_chunk in create_chat_completion_stream(request):
            full_response.append(text_chunk)
            yield f"data: {text_chunk}\n\n"

        # After streaming is complete, save the full response to the database
        assistant_message = Message(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            role="assistant",
            content="".join(full_response),
        )
        session.add(assistant_message)

        # Update conversation timestamp
        conversation.updated_at = datetime.utcnow()
        session.add(conversation)
        session.commit()

        yield "data: [DONE]\n\n"

    return StreamingResponse(response_generator(), media_type="text/event-stream")
