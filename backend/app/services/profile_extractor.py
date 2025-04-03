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


# Define types for extracted insights
class ExtractedInsight:
    def __init__(
        self,
        insight_type: str,
        value: str,
        confidence: float = 0.0,
        emotional_significance: float = 0.0,
        day_of_week: str | None = None,
        time_of_day: str | None = None,
    ):
        self.type = insight_type
        self.value = value
        self.confidence = confidence
        self.emotional_significance = emotional_significance
        self.day_of_week = day_of_week
        self.time_of_day = time_of_day

    def to_dict(self) -> dict[str, Any]:
        """Convert insight to dictionary for JSON serialization"""
        return {
            "type": self.type,
            "value": self.value,
            "confidence": self.confidence,
            "emotional_significance": self.emotional_significance,
            "day_of_week": self.day_of_week,
            "time_of_day": self.time_of_day,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ExtractedInsight":
        """Create insight from dictionary"""
        return cls(
            insight_type=data.get("type", "unknown"),
            value=data.get("value", ""),
            confidence=data.get("confidence", 0.0),
            emotional_significance=data.get("emotional_significance", 0.0),
            day_of_week=data.get("day_of_week"),
            time_of_day=data.get("time_of_day"),
        )


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
                    # Convert to dictionary if it's an ExtractedInsight object
                    insight_dict = (
                        insight.to_dict()
                        if isinstance(insight, ExtractedInsight)
                        else insight
                    )

                    user_insight = UserInsight(
                        user_id=user_id,
                        profile_id=profile.id,
                        conversation_id=conversation_id,
                        insight_type=insight_dict.get("type", "unknown"),
                        value=insight_dict.get("value", ""),
                        day_of_week=insight_dict.get("day_of_week"),
                        time_of_day=insight_dict.get("time_of_day"),
                        emotional_significance=insight_dict.get(
                            "emotional_significance", 0.5
                        ),
                        confidence=insight_dict.get("confidence", 0.5),
                    )
                    session.add(user_insight)

                # Update profile based on insights
                update_profile_from_insights(session, profile, insights)

                # Update profile metrics (RRS, motivation)
                await calculate_relapse_risk_score(session, profile, insights, messages)

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
) -> list[ExtractedInsight]:
    """Extract insights from conversation using OpenAI with enhanced accuracy"""
    try:
        # Format messages for analysis
        conversation_text = "\n".join(
            [f"{msg.role.upper()}: {msg.content}" for msg in messages]
        )

        # Create prompt for OpenAI with more detailed instructions
        system_prompt = f"""
        You are an expert addiction therapist and data analyst specializing in motivational interviewing techniques.
        Analyze this conversation between a user and an AI therapist to extract insights about the user's addiction profile.

        Current user profile:
        Addiction type: {profile.addiction_type or "Unknown"}
        Abstinence days: {profile.abstinence_days or 0}
        Motivation level (1-10): {profile.motivation_level or "Unknown"}

        Extract insights in the following categories:
        1. addiction_type - The specific addiction the person is dealing with (e.g., alcohol, drugs, gambling)
        2. trigger - Situations, emotions, or contexts that lead to addictive behavior or cravings
        3. coping_strategy - Methods the user employs or could employ to manage cravings and avoid relapse
        4. schedule - Routine events, habits, or patterns in the user's life, especially those related to addiction
        5. motivation - Factors that drive the user's desire to change or maintain abstinence
        6. goal - Specific objectives the user has mentioned about recovery or life improvement
        7. abstinence - Information about sobriety duration, abstinence attempts, or relapse history
        8. emotion - Significant emotional states experienced by the user, especially those connected to addiction
        9. social_support - People, groups, or relationships that help or hinder the user's recovery
        10. relapse_risk - Indicators suggesting potential for relapse or struggling

        For each insight, provide:
        - A clear, specific value that captures the essence of the insight
        - A confidence score (0.0-1.0) indicating how certain you are about this insight
        - An emotional_significance score (0.0-1.0) indicating how important this seems to the user
        - For schedule-related insights, include day_of_week and time_of_day if mentioned

        Format your response as JSON:
        [
          {{
            "type": "addiction_type|trigger|coping_strategy|schedule|motivation|goal|abstinence|emotion|social_support|relapse_risk",
            "value": "Description of the insight",
            "confidence": 0.8,
            "emotional_significance": 0.7,
            "day_of_week": "Monday", (only for schedule type)
            "time_of_day": "evening", (only for schedule type)
          }}
        ]

        Only include insights where confidence > 0.6.
        Include a maximum of 5 most important insights (prioritize by emotional_significance).
        Be precise, specific, and avoid vague generalizations.
        """

        openai_client = get_openai_client()

        response = await openai_client.chat.completions.create(
            model="gpt-4o",  # Using a more capable model for better extraction
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Here is the conversation to analyze:\n\n{conversation_text}",
                },
            ],
            temperature=0.2,  # Lower temperature for more consistent outputs
            max_tokens=1500,
        )

        response_text = response.choices[0].message.content

        # Try multiple approaches to extract valid JSON
        insights = extract_json_with_fallbacks(response_text)

        # Convert dictionaries to ExtractedInsight objects
        return [
            ExtractedInsight.from_dict(insight)
            if isinstance(insight, dict)
            else insight
            for insight in insights
        ]

    except Exception as e:
        logger.error(f"Error extracting insights: {str(e)}")
        return []


def extract_json_with_fallbacks(text: str) -> list[dict[str, Any]]:
    """Try multiple approaches to extract valid JSON from text"""
    # First attempt: direct JSON parsing
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and "insights" in data:
            return data["insights"]
    except json.JSONDecodeError:
        pass

    # Second attempt: find JSON array pattern with regex
    json_pattern = r"\[\s*\{.*\}\s*\]"
    json_match = re.search(json_pattern, text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    # Third attempt: find individual JSON objects and combine them
    object_pattern = r'\{\s*"type":\s*"[^"]+",.*?\}'
    object_matches = re.findall(object_pattern, text, re.DOTALL)
    if object_matches:
        insights = []
        for match in object_matches:
            try:
                insight = json.loads(match)
                insights.append(insight)
            except json.JSONDecodeError:
                continue
        if insights:
            return insights

    # Final fallback: no valid JSON found
    logger.warning("Could not extract valid JSON from response")
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
