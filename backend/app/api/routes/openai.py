import asyncio
import logging
import os
import traceback
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from openai import AsyncOpenAI  # <-- Use AsyncOpenAI instead of OpenAI
from sqlmodel import Session, select

from app.api.deps import CurrentUser, SessionDep, UsageLimitCheck
from app.api.routes.stripe import increment_usage
from app.core.db import (
    engine,  # This should import your actual SQLAlchemy engine instance
)
from app.models import (
    Conversation,
    ConversationCreate,
    ConversationWithMessages,
    Message,
    MessageSchema,
    UserGoal,
)

# Import the service function directly
from app.services.profile_extractor import process_conversation_for_profile

router = APIRouter(prefix="/openai", tags=["openai"])

api_key = os.environ.get("OPENAI_API_KEY")

# Initialize AsyncOpenAI client
openai_client = None
if api_key:
    openai_client = AsyncOpenAI(api_key=api_key)


def get_openai_client():
    """Get OpenAI client instance"""
    global openai_client
    if not openai_client and api_key:
        openai_client = AsyncOpenAI(api_key=api_key)
    return openai_client


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

# Environment variable debugging
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

# Safely log key info without revealing the full key
if api_key:
    key_length = len(api_key)
    key_prefix = api_key[:4] + "..." if len(api_key) > 4 else ""
    logger.info(f"✅ OpenAI API key found: length={key_length}, prefix={key_prefix}")
else:
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

# Direct API key test
logger.info(
    f"Direct API key test: {'✅ Found (length: ' + str(len(api_key)) + ')' if api_key else '❌ Not found'}"
)

# Log OpenAI client status
logger.info(
    f"OpenAI client status: {'✅ Initialized' if openai_client else '❌ Not initialized'}"
)

logger.info("======== OPENAI CLIENT SETUP COMPLETE ========")

# Models to try in order of preference (fallback mechanism)
MODELS_TO_TRY = [
    "gpt-4o",  # Make this your primary model
    "gpt-4",   # Secondary fallback
    "gpt-3.5-turbo",  # Last resort
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
    client = get_openai_client()

    for model in models_to_try:
        retries = 0
        while retries < max_retries:
            try:
                logger.info(
                    f"Calling OpenAI API with model: {model} (attempt {retries+1}/{max_retries})"
                )
                # This is now a properly awaitable call
                completion = await client.chat.completions.create(
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


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageSchema,
    dependencies=[UsageLimitCheck],
)
async def create_message(
    message: MessageSchema,
    conversation_id: uuid.UUID,
    current_user: CurrentUser,
    session: SessionDep,
    background_tasks: BackgroundTasks,
) -> MessageSchema:
    """Create a new message and get a response from OpenAI"""
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

        # Increment usage - this will be skipped for subscribers
        increment_usage(session=session, current_user=current_user)

        # Verify OpenAI client is available
        client = get_openai_client()
        if not client:
            logger.error("OpenAI client not available")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="OpenAI API not properly configured",
            )

        # Save user message to database
        db_message = Message(
            conversation_id=conversation_id,
            role=message.role,
            content=message.content,
            # Add metadata if available
            message_metadata=message.metadata or None
        )
        session.add(db_message)
        session.commit()
        session.refresh(db_message)  # Get the ID for logging

        logger.info(f"Saved user message with ID: {db_message.id}")

        # Get conversation history
        history = session.exec(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at)
        ).all()

        messages_for_api = [
            {"role": msg.role, "content": msg.content} for msg in history
        ]

        # Add system message if not present with specific motivational interviewing guidance
        if not any(msg["role"] == "system" for msg in messages_for_api):
            messages_for_api.insert(
                0,
                {
                    "role": "system",
                    "content": """You are a caring, empathetic AI therapist helping people overcome addiction. Your goal is to motivate change using motivational interviewing techniques:
                    1. Express empathy through reflective listening
                    2. Develop discrepancy between goals and behaviors
                    3. Avoid argumentation and direct confrontation
                    4. Adjust to client resistance
                    5. Support self-efficacy and optimism

                    Guide the conversation through these stages:
                    - First engage and build rapport
                    - Focus on specific addiction behaviors
                    - Evoke the client's own motivations for change
                    - Plan steps forward when ready

                    Make sure to identify triggers, psychological traits, and possible coping strategies. Be warm, non-judgmental, and empathetic throughout.""",
                },
            )

        logger.info(f"Sending {len(messages_for_api)} messages to OpenAI API")

        # Call OpenAI API with fallback mechanism
        completion = await call_openai_with_fallback(
            messages_for_api,
            requested_model="gpt-4o",
            max_retries=3,
        )

        # Extract assistant message
        assistant_message = completion.choices[0].message.content

        # Determine the current stage of motivational interviewing
        mi_stage = determine_mi_stage(messages_for_api, assistant_message)
        
        # Save assistant response to database with MI stage metadata
        db_assistant_message = Message(
            conversation_id=conversation_id,
            role="assistant",
            content=assistant_message,
            message_metadata={"stage": mi_stage}
        )
        session.add(db_assistant_message)

        # Update conversation timestamp
        conversation.updated_at = datetime.utcnow()
        session.commit()
        session.refresh(db_assistant_message)  # Get the ID for logging

        logger.info(f"Saved assistant message with ID: {db_assistant_message.id} and MI stage: {mi_stage}")

        # Check if the conversation has reached a goal-setting stage
        is_goal_accepted, goal_description = detect_goal_acceptance(
            messages_for_api, assistant_message
        )

        if is_goal_accepted and goal_description:
            logger.info(f"Goal accepted: {goal_description}")

            # Create the goal
            user_goal = UserGoal(
                user_id=current_user.id, 
                description=goal_description, 
                status="active",
                mi_related=True  # Mark this as MI-related goal
            )
            session.add(user_goal)
            session.commit()
            session.refresh(user_goal)
            
            logger.info(f"Created goal with ID: {user_goal.id}")

            # Process the conversation with goal acceptance context
            try:
                await process_conversation_for_profile(
                    session_factory=lambda: Session(engine),
                    conversation_id=str(conversation_id),
                    user_id=str(current_user.id),
                    is_goal_accepted=True,
                    goal_description=goal_description,
                )
                logger.info(f"Profile extraction completed for conversation {conversation_id} with goal acceptance")
            except Exception as profile_error:
                logger.error(f"Error in profile extraction with goal: {str(profile_error)}")
                logger.error(traceback.format_exc())
                # Continue execution even if profile extraction fails
        else:
            # Regular background processing - make it synchronous for better debugging
            try:
                logger.info(f"Starting background profile extraction for conversation {conversation_id}")
                await process_conversation_for_profile(
                    session_factory=lambda: Session(engine),
                    conversation_id=str(conversation_id),
                    user_id=str(current_user.id),
                )
                logger.info(f"Background profile extraction completed for conversation {conversation_id}")
            except Exception as profile_error:
                logger.error(f"Error in background profile extraction: {str(profile_error)}")
                logger.error(traceback.format_exc())
                # Continue execution even if profile extraction fails

        # Return assistant message with stage metadata
        return MessageSchema(
            role="assistant", 
            content=assistant_message,
            metadata={"stage": mi_stage}
        )

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


def determine_mi_stage(messages: list[dict], current_message: str) -> str:
    """
    Determine the current stage of Motivational Interviewing based on the conversation context.
    
    Returns one of:
    - "engaging": Building rapport and relationship
    - "focusing": Identifying specific behaviors to change
    - "evoking": Drawing out client's own motivations for change
    - "planning": Developing commitment to change and specific plan
    """
    # Count of messages to establish context
    message_count = len(messages)
    
    # Default to engaging for new conversations
    if message_count <= 3:
        return "engaging"
    
    # Look for key phrases in the current message
    current_lower = current_message.lower()
    
    # Planning indicators
    if any(phrase in current_lower for phrase in [
        "what steps will you take",
        "let's create a plan",
        "how will you achieve",
        "specific actions",
        "your goal could be",
        "i suggest setting a goal",
        "commit to"
    ]):
        return "planning"
    
    # Evoking indicators
    if any(phrase in current_lower for phrase in [
        "why is this important to you",
        "what would change look like",
        "how would things be different",
        "what are your reasons",
        "on a scale of 1 to 10",
        "what motivates you to change",
        "what concerns you about"
    ]):
        return "evoking"
    
    # Focusing indicators
    if any(phrase in current_lower for phrase in [
        "tell me more about",
        "could you describe",
        "what specific aspects",
        "which behaviors are most",
        "how often do you",
        "in what situations do you"
    ]):
        return "focusing"
    
    # Default to the most recent non-engaging stage to maintain continuity
    for msg in reversed(messages):
        if msg.get("role") == "assistant" and msg.get("metadata", {}).get("stage") in ["focusing", "evoking", "planning"]:
            return msg["metadata"]["stage"]
    
    # Default to focusing if we can't determine the stage
    return "focusing"

def detect_goal_acceptance(messages, latest_assistant_message):
    """
    Analyze messages to detect if a goal was proposed and accepted.
    Returns (is_goal_accepted, goal_description) tuple
    """
    # First, check if the latest assistant message proposes a goal
    goal_proposal_indicators = [
        "your goal could be",
        "i suggest setting a goal",
        "here's a goal for you",
        "i recommend that you",
        "a good goal would be",
        "try to achieve",
        "commit to",
        "your task is to",
        "your assignment is",
    ]

    goal_proposed = any(
        indicator in latest_assistant_message.lower()
        for indicator in goal_proposal_indicators
    )

    if not goal_proposed:
        # No goal was proposed in the most recent message
        return False, None

    # Look for user acceptance in previous exchanges
    for i in range(len(messages) - 2, 0, -1):  # Start from the second-to-last message
        if messages[i]["role"] == "assistant" and messages[i + 1]["role"] == "user":
            assistant_msg = messages[i]["content"].lower()
            user_response = messages[i + 1]["content"].lower()

            # Check if the assistant proposed a goal
            if any(
                indicator in assistant_msg for indicator in goal_proposal_indicators
            ):
                # Check if user accepted
                acceptance_indicators = [
                    "yes",
                    "sure",
                    "okay",
                    "ok",
                    "i'll do it",
                    "sounds good",
                    "i will",
                    "i agree",
                    "good idea",
                    "i can do that",
                    "i'll try",
                    "i accept",
                ]

                if any(
                    acceptance in user_response for acceptance in acceptance_indicators
                ):
                    # Extract goal description - this is a simple implementation
                    # You might want to use more sophisticated NLP here
                    goal_description = extract_goal_from_message(assistant_msg)
                    return True, goal_description

    # If we just proposed a goal but don't have a response yet, don't trigger
    return False, None


def extract_goal_from_message(message):
    """
    Extract a goal description from an assistant message.
    This is a simple implementation - for production, consider using NLP.
    """
    # Look for common patterns like "your goal could be X" or "I suggest X"
    message = message.lower()

    for pattern in [
        "your goal could be to",
        "i suggest",
        "here's a goal for you:",
        "i recommend that you",
        "a good goal would be to",
        "try to",
        "commit to",
        "your task is to",
        "your assignment is to",
    ]:
        if pattern in message:
            start_index = message.find(pattern) + len(pattern)
            # Get text after the pattern until the end of sentence
            sentence_end = message.find(".", start_index)
            if sentence_end == -1:  # No period found
                sentence_end = len(message)

            goal_text = message[start_index:sentence_end].strip()
            return goal_text

    # If no specific pattern found, return a larger chunk of the message
    # This is a fallback method
    sentences = message.split(".")
    for sentence in sentences:
        if any(
            word in sentence for word in ["goal", "task", "commit", "try", "recommend"]
        ):
            return sentence.strip()

    # Last resort: just return something reasonable
    return "Goal from the conversation"


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
