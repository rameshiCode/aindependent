# app/services/profile_extractor.py
import json
import logging
import re
from datetime import datetime, timedelta
from typing import Any

from sqlmodel import Session, select

from app.models import Conversation, Message, UserGoal, UserInsight, UserProfile

# Import from common module instead of from openai.py
from app.services.openai_client import get_openai_client

logger = logging.getLogger(__name__)


async def process_conversation_for_profile(
    session_factory, conversation_id: str, user_id: str
):
    """Process a conversation to extract profile insights

    Args:
        session_factory: Function to create a new database session
        conversation_id: ID of the conversation to process
        user_id: ID of the user who owns the conversation
    """
    # Create a new session using the factory
    with session_factory() as session:
        try:
            logger.info(f"Processing conversation {conversation_id} for user {user_id}")

            # Get conversation
            conversation = session.exec(
                select(Conversation)
                .where(Conversation.id == conversation_id)
                .where(Conversation.user_id == user_id)
            ).first()

            if not conversation:
                logger.error(
                    f"Conversation {conversation_id} not found for user {user_id}"
                )
                return

            # Get messages
            messages = session.exec(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.created_at)
            ).all()

            if not messages:
                logger.info(f"No messages found in conversation {conversation_id}")
                return

            # Get or create user profile
            profile = session.exec(
                select(UserProfile).where(UserProfile.user_id == user_id)
            ).first()

            if not profile:
                logger.info(f"Creating new profile for user {user_id}")
                profile = UserProfile(user_id=user_id)
                session.add(profile)
                session.commit()
                session.refresh(profile)

            # Extract insights from the conversation
            insights = await extract_insights_from_conversation(messages, profile)

            if insights:
                # Save insights to database
                for insight in insights:
                    user_insight = UserInsight(
                        user_id=user_id,
                        conversation_id=conversation_id,
                        insight_type=insight.get("type", "unknown"),
                        value=insight.get("value", ""),
                        day_of_week=insight.get("day_of_week"),
                        time_of_day=insight.get("time_of_day"),
                        emotional_significance=insight.get(
                            "emotional_significance", 0.5
                        ),
                        confidence=insight.get("confidence", 0.5),
                    )
                    session.add(user_insight)

                # Update profile based on insights
                update_profile_from_insights(session, profile, insights)
                session.commit()
                logger.info(f"Saved {len(insights)} insights for user {user_id}")
            else:
                logger.info(
                    f"No insights extracted from conversation {conversation_id}"
                )

        except Exception as e:
            logger.error(f"Error processing conversation: {str(e)}")
            # Don't re-raise, this is a background task


async def extract_insights_from_conversation(
    messages: list[Message], profile: UserProfile
) -> list[dict[str, Any]]:
    """Extract insights from conversation using OpenAI"""
    try:
        # Format messages for analysis
        conversation_text = "\n".join(
            [f"{msg.role.upper()}: {msg.content}" for msg in messages]
        )

        # Create prompt for OpenAI
        system_prompt = f"""
        You are an expert addiction therapist and data analyst.
        Analyze this conversation between a user and an AI therapist
        to extract insights about the user's addiction profile.

        Current user profile:
        Addiction type: {profile.addiction_type or "Unknown"}
        Abstinence days: {profile.abstinence_days or 0}
        Motivation level (1-10): {profile.motivation_level or "Unknown"}

        Extract insights in the following categories:
        1. addiction_type - What specific addiction the person is dealing with
        2. trigger - Situations that lead to addictive behavior
        3. coping_strategy - Ways the user manages cravings
        4. schedule - Routine events in the user's life
        5. motivation - What motivates the user to change
        6. goal - Specific goals mentioned
        7. abstinence - Info about sobriety or abstinence
        8. emotion - Significant emotional states

        Format your response as JSON:
        [
          {{
            "type": "addiction_type|trigger|coping_strategy|schedule|motivation|goal|abstinence|emotion",
            "value": "Description of the insight",
            "day_of_week": "Monday", (for schedule types)
            "time_of_day": "evening", (for schedule types)
            "emotional_significance": 0.8, (0.0-1.0 scale)
            "confidence": 0.9 (0.0-1.0 scale)
          }}
        ]

        Only include insights where confidence > 0.6, and include maximum 3 most important insights.
        """

        openai_client = get_openai_client()

        response = await openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Here is the conversation to analyze:\n\n{conversation_text}",
                },
            ],
            temperature=0.2,
            max_tokens=1000,
        )

        response_text = response.choices[0].message.content

        # Try to parse the response as JSON
        try:
            insights = json.loads(response_text)
            if isinstance(insights, list):
                return insights
            elif isinstance(insights, dict) and "insights" in insights:
                return insights["insights"]
            else:
                logger.error(f"Unexpected JSON structure: {insights}")
                return []
        except json.JSONDecodeError:
            # Try to extract JSON from text
            json_match = re.search(r"\[\s*\{.*\}\s*\]", response_text, re.DOTALL)
            if json_match:
                try:
                    insights = json.loads(json_match.group(0))
                    return insights
                except:
                    logger.error("Failed to parse JSON from match")
                    return []
            else:
                logger.error("No JSON found in response")
                return []

    except Exception as e:
        logger.error(f"Error extracting insights: {str(e)}")
        return []


def update_profile_from_insights(
    session: Session, profile: UserProfile, insights: list[dict[str, Any]]
):
    """Update user profile based on extracted insights"""
    for insight in insights:
        # Skip low confidence insights
        if insight.get("confidence", 0) < 0.6:
            continue

        insight_type = insight.get("type")
        value = insight.get("value", "")

        # Update addiction type if not already set
        if insight_type == "addiction_type" and not profile.addiction_type:
            profile.addiction_type = value

        # Update motivation level
        elif insight_type == "motivation":
            # Try to extract a numerical value from 1-10
            motivation_match = re.search(r"(\d+)(?:\s*\/\s*10|$)", value)
            if motivation_match:
                try:
                    motivation = int(motivation_match.group(1))
                    if 1 <= motivation <= 10:
                        profile.motivation_level = motivation
                except ValueError:
                    pass

        # Update abstinence information
        elif insight_type == "abstinence":
            # Try to extract days of abstinence
            days_match = re.search(r"(\d+)\s*days?", value)
            if days_match:
                try:
                    days = int(days_match.group(1))
                    profile.abstinence_days = days
                    # If abstinence start date not set, calculate it
                    if not profile.abstinence_start_date:
                        profile.abstinence_start_date = datetime.utcnow() - timedelta(
                            days=days
                        )
                except ValueError:
                    pass

            # Check for relapse mentions
            if "relapse" in value.lower() or "slip" in value.lower():
                # Reset abstinence counter
                profile.abstinence_days = 0
                profile.abstinence_start_date = datetime.utcnow()

        # Create goals from goal insights
        elif insight_type == "goal" and insight.get("confidence", 0) > 0.7:
            # Check if this seems like a specific, actionable goal
            if len(value) > 10:  # Minimum length for a meaningful goal
                # Check if we already have a similar goal
                existing_goals = session.exec(
                    select(UserGoal)
                    .where(UserGoal.user_id == profile.user_id)
                    .where(UserGoal.status == "active")
                ).all()

                # Simple similarity check to avoid duplicates
                if not any(
                    goal.description.lower() in value.lower()
                    or value.lower() in goal.description.lower()
                    for goal in existing_goals
                ):
                    new_goal = UserGoal(
                        user_id=profile.user_id, description=value, status="active"
                    )
                    session.add(new_goal)

    # Update last_updated timestamp
    profile.last_updated = datetime.utcnow()
    session.add(profile)
