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

    # Updated system prompt (preprompt) that includes MI instructions and the metadata directive.
    system_prompt = {
        "role": "system",
        "content": (
            "You are a compassionate, non-judgmental, and professional AI therapist specializing in Motivational Interviewing (MI) for addiction recovery. "
            "Your goal is to engage users meaningfully, help them explore their motivations, and guide them toward change by building a comprehensive user profile. \n\n"
            "At the beginning of the session, feel free to offer conversation starters if needed. Follow these principles: \n"
            "1. Express Empathy: Listen and validate without judgment. \n"
            "2. Develop Discrepancy: Help the user recognize differences between current behaviors and personal goals. \n"
            "3. Roll with Resistance: Avoid confrontation and respect ambivalence. \n"
            "4. Support Self-Efficacy: Encourage belief in the ability to change. \n\n"
            "Guide the conversation through the following stages: engaging, focusing, evoking, and planning. "
            "For every response, include a metadata field 'mi_stage' with one of these values. "
            "Additionally, if you are summarizing or wrapping up—when you have provided a clear plan or detected commitment from the user—and you are no longer asking further questions, include 'summary_style': true in your metadata. "
            "Begin by asking an open-ended question if the conversation is just starting."
        ),
    }

    # Format messages for OpenAI: include our custom preprompt and the user's message.
    messages_for_api = [
        system_prompt,
        {"role": "user", "content": message.get("content", "")},
    ]

    # Call OpenAI API with fallback mechanism
    completion = await call_openai_with_fallback(
        messages_for_api,
        requested_model="gpt-3.5-turbo",
        max_retries=3,
    )

    # Get the assistant's response
    assistant_content = completion.choices[0].message.content
    response = {"role": "assistant", "content": assistant_content}

    # Here, ideally the assistant also returns metadata within its response.
    # You can parse that from the API response if it's provided; for now, we use a helper:
    mi_stage = determine_mi_stage(messages_for_api, assistant_content)
    # In your updated determine_mi_stage function, make sure you also look for a "summary_style" signal.
    # For example, you could have it return a dict or update the metadata.
    # Here we'll assume it returns a string, and that we later supplement metadata separately.
    response["metadata"] = {"stage": mi_stage}

    # Analyze the user's message for initial profile cues
    conversation_analyzer.analyze_message(user_id, message)

    # Analyze the assistant's response too, capturing additional insights as needed
    conversation_analyzer.analyze_message(user_id, response)

    # *** New Step: Check if the assistant's message signals a wrap-up ***
    # You could have your determine_mi_stage function or an additional check that inspects the assistant response for a "summary_style"
    summary_style = False
    # For example, if the assistant response contains a phrase like "I recommend" or "let's review your plan",
    # or if you've embedded a special token in the response metadata.
    if response.get("metadata", {}).get("summary_style"):
        summary_style = True
    # Alternatively, you could inspect the response content:
    if "i will" in assistant_content.lower() or "commit" in assistant_content.lower():
        summary_style = True
        response["metadata"]["summary_style"] = True

    # If the MI stage is planning and the response signals wrap-up, trigger combined profile analysis.
    if mi_stage == "planning" and summary_style:
        try:
            # Get the profile analyzer service instance
            profile_analyzer = ProfileAnalysisService(lambda: Session(engine))
            # You might want to trigger a combined conversation analysis here.
            # This should do a short validation check to confirm that a plan + commitment have been stated
            # and then extract structured profile insights.
            result = await profile_analyzer.process_conversation(
                conversation_id="(current_conversation_id)",  # Replace with your conversation ID retrieval logic
                user_id=user_id,
            )
            # Log the result or update the profile as needed.
            logger.info(f"Combined profile analysis triggered: {result}")
        except Exception as e:
            logger.error(f"Error in combined profile extraction: {str(e)}")
            # Continue even if profile extraction fails.

    # Additionally, perform regular background profile extraction (if desired)
    try:
        profile_analyzer = ProfileAnalysisService(lambda: Session(engine))
        # Separate analysis for user and assistant insights
        user_insights = await profile_analyzer.analyze_message(user_id, message)
        assistant_insights = await profile_analyzer.analyze_message(user_id, response)
        logger.info(
            f"Extracted {len(user_insights) + len(assistant_insights)} insights from chat."
        )
    except Exception as e:
        logger.error(f"Error in regular profile analysis: {str(e)}")
        # Continue even if profile analysis fails

    return response


def detect_goal_acceptance_in_conversation(conversation_id, session):
    """
    Analyze conversation messages to detect if a goal was accepted by the user.

    We consider a goal accepted if any user message contains keywords like
    "agree", "accept", "goal", or "commit". In a more advanced implementation,
    you could also inspect MI metadata (e.g., a wrap-up flag) to increase accuracy.

    Args:
        conversation_id: ID of the conversation to analyze.
        session: Database session.

    Returns:
        tuple: (is_goal_accepted, goal_description)
    """
    from sqlmodel import select

    from app.models import Message

    # Retrieve all messages for the conversation, ordered by creation time.
    messages = session.exec(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    ).all()

    is_goal_accepted = False
    goal_description = None

    # Loop through user messages to find goal acceptance indicators.
    for message in messages:
        if message.role == "user":
            if any(
                keyword in message.content.lower()
                for keyword in ["agree", "accept", "goal", "commit"]
            ):
                is_goal_accepted = True
                goal_description = message.content
                break

    return is_goal_accepted, goal_description


@router.post("/chat/{user_id}/end")
async def end_chat(user_id: str):
    """End the conversation and perform comprehensive profile analysis."""
    # First, mark the conversation as finished using your conversation analyzer.
    success = conversation_analyzer.end_conversation(user_id)

    try:
        from sqlmodel import Session, select

        from app.core.db import engine
        from app.models import Conversation

        with Session(engine) as session:
            # Find the most recent conversation for this user.
            conversation = session.exec(
                select(Conversation)
                .where(Conversation.user_id == uuid.UUID(user_id))
                .order_by(Conversation.updated_at.desc())
            ).first()

            if conversation:
                # Get an instance of your profile analysis service.
                profile_analyzer = ProfileAnalysisService(lambda: Session(engine))

                # Process the conversation to extract profile insights.
                result = await profile_analyzer.process_conversation(
                    str(conversation.id), user_id
                )
                logger.info(f"Profile analysis result: {result}")

                # Detect if a goal was accepted in this conversation.
                (
                    is_goal_accepted,
                    goal_description,
                ) = detect_goal_acceptance_in_conversation(conversation.id, session)

                if is_goal_accepted and goal_description:
                    # Re-run processing with goal context (if required by your logic).
                    await profile_analyzer.process_conversation(
                        str(conversation.id),
                        user_id,
                        is_goal_accepted=True,
                        goal_description=goal_description,
                    )
    except Exception as e:
        logger.error(f"Error in end conversation profile analysis: {str(e)}")
        # Continue even if profile analysis fails.

    return {"success": success}
