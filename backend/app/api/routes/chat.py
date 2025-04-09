import uuid

from fastapi import APIRouter, Depends, logger
from sqlmodel import Session

from app.api.deps import get_db
from app.api.routes.openai import (
    call_openai_with_fallback,
    determine_mi_stage,
    get_openai_client,
)
from app.core.db import engine
from app.services.conversation_analyzer import ConversationAnalyzer
from app.services.profile_analysis_service import ProfileAnalysisService
from app.services.profile_service import ProfileService

router = APIRouter()
profile_service = ProfileService()
conversation_analyzer = ConversationAnalyzer(profile_service)


@router.post("/chat/{user_id}")
async def chat(user_id: str, message: dict, db: Session = Depends(get_db)):
    """Process a chat message and analyze it for profile information"""
    # Get or initialize OpenAI client
    client = get_openai_client()

    # Format messages for OpenAI
    messages_for_api = [
        {
            "role": "system",
            "content": "You are a caring, empathetic AI therapist helping people overcome addiction.",
        },
        {"role": "user", "content": message.get("content", "")},
    ]

    # Call OpenAI API with fallback mechanism
    completion = await call_openai_with_fallback(
        messages_for_api,
        requested_model="gpt-3.5-turbo",
        max_retries=3,
    )

    # Get the assistant's response
    response = {"role": "assistant", "content": completion.choices[0].message.content}

    # Analyze the user's message for profile information
    conversation_analyzer.analyze_message(user_id, message)

    # Add MI stage detection to response metadata
    mi_stage = determine_mi_stage(messages_for_api, response.get("content", ""))
    response["metadata"] = {"stage": mi_stage}

    # Analyze assistant's response too
    conversation_analyzer.analyze_message(user_id, response)

    # Trigger profile analysis service to process this message
    try:
        # Get the profile analyzer service
        profile_analyzer = ProfileAnalysisService(lambda: Session(engine))

        # Analyze the user message for immediate insights
        user_insights = await profile_analyzer.analyze_message(user_id, message)

        # Analyze the assistant response for additional insights
        assistant_insights = await profile_analyzer.analyze_message(user_id, response)

        logger.info(
            f"Extracted {len(user_insights) + len(assistant_insights)} insights from chat"
        )
    except Exception as e:
        logger.error(f"Error in profile analysis: {str(e)}")
        # Continue even if profile analysis fails

    return response


def detect_goal_acceptance_in_conversation(conversation_id, session):
    """
    Analyze conversation messages to detect if a goal was accepted by the user.

    Args:
        conversation_id: ID of the conversation to analyze
        session: Database session

    Returns:
        tuple: (is_goal_accepted, goal_description)
    """
    from sqlmodel import select

    from app.models import Message

    # Query all messages in the conversation
    messages = session.exec(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    ).all()

    # Simple detection logic - in a real app this would be more sophisticated
    is_goal_accepted = False
    goal_description = None

    for message in messages:
        if message.role == "user" and any(
            keyword in message.content.lower()
            for keyword in ["agree", "accept", "goal", "commit"]
        ):
            is_goal_accepted = True
            goal_description = message.content
            break

    return is_goal_accepted, goal_description


@router.post("/chat/{user_id}/end")
async def end_chat(user_id: str):
    """End the conversation and perform comprehensive profile analysis"""
    # First use the conversation analyzer to process the conversation
    success = conversation_analyzer.end_conversation(user_id)

    # Then, use the profile analysis service for more comprehensive analysis
    try:
        # Get the last conversation ID for this user
        from sqlmodel import Session, select

        from app.core.db import engine
        from app.models import Conversation

        with Session(engine) as session:
            # Find the latest conversation for this user
            conversation = session.exec(
                select(Conversation)
                .where(Conversation.user_id == uuid.UUID(user_id))
                .order_by(Conversation.updated_at.desc())
            ).first()

            if conversation:
                # Process the conversation with the profile analyzer
                profile_analyzer = ProfileAnalysisService(lambda: Session(engine))
                result = await profile_analyzer.process_conversation(
                    str(conversation.id), user_id
                )
                logger.info(f"Profile analysis result: {result}")

                # If goal was accepted during conversation, extract it
                (
                    is_goal_accepted,
                    goal_description,
                ) = detect_goal_acceptance_in_conversation(conversation.id, session)

                if is_goal_accepted and goal_description:
                    # Process the conversation with goal context
                    await profile_analyzer.process_conversation(
                        str(conversation.id),
                        user_id,
                        is_goal_accepted=True,
                        goal_description=goal_description,
                    )
    except Exception as e:
        logger.error(f"Error in end conversation profile analysis: {str(e)}")
        # Continue even if profile analysis fails

    return {"success": success}
