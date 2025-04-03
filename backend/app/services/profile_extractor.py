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
    """Extract insights from conversation with enhanced context and categorization."""
    try:
        # Format messages for analysis
        conversation_text = "\n".join(
            [f"{msg.role.upper()}: {msg.content}" for msg in messages]
        )

        # Create a more advanced prompt with contextual information
        system_prompt = f"""
        You are an expert addiction therapist and psychological profiler specializing in motivational interviewing and cognitive behavioral therapy.
        Analyze this conversation between a user and an AI therapist to extract detailed insights about the user's addiction profile.

        Current user profile:
        Addiction type: {profile.addiction_type or "Unknown"}
        Abstinence days: {profile.abstinence_days or 0}
        Motivation level (1-10): {profile.motivation_level or "Unknown"}
        Risk level: {profile.relapse_risk_score or "Unknown"}

        Extract insights in these categories:
        1. addiction_type - The specific addiction (alcohol, drugs, gambling, etc.) and any subtypes or specific substances
        2. trigger_emotional - Emotional states that lead to cravings or relapse (anxiety, depression, loneliness, etc.)
        3. trigger_situational - External situations that trigger cravings (social events, locations, people, etc.)
        4. trigger_temporal - Time-based patterns related to cravings or usage (evenings, weekends, specific days)
        5. coping_strategy_existing - Methods the user already employs to manage cravings
        6. coping_strategy_potential - New methods the user could employ based on their personality and situation
        7. schedule - Routines or timing patterns in the user's life that may impact addiction
        8. motivation_intrinsic - Internal factors driving the user to change (health, self-esteem, values)
        9. motivation_extrinsic - External factors driving change (relationships, career, legal issues)
        10. goal_short_term - Specific objectives for the near future (days/weeks)
        11. goal_long_term - Broader objectives for long-term recovery (months/years)
        12. abstinence - Information about sobriety duration, attempts, or relapse history
        13. emotion_positive - Positive emotions expressed by the user
        14. emotion_negative - Negative emotions expressed by the user
        15. social_support_positive - People or relationships that help recovery
        16. social_support_negative - People or relationships that hinder recovery
        17. relapse_risk - Specific indicators suggesting potential for relapse
        18. self_efficacy - User's belief in their ability to maintain recovery
        19. value_alignment - Personal values mentioned that could support recovery
        20. stage_of_change - Assessment of where user is in stages of change (precontemplation, contemplation, preparation, action, maintenance)

        For each insight:
        - Provide a specific value that captures the essence of the insight
        - Assign a confidence score (0.0-1.0) based on clarity and frequency of evidence
        - Assign an emotional_significance score (0.0-1.0) indicating importance to the user
        - For temporal insights, include day_of_week and time_of_day if mentioned

        Focus on identifying patterns and connections between different insights.
        Prioritize recent statements over older ones.
        Only include insights where confidence > 0.65.
        Include a maximum of 8 most important insights (prioritize by emotional_significance).

        Format as JSON:
        [
          {{
            "type": "category_subcategory",
            "value": "Description of the insight",
            "confidence": 0.8,
            "emotional_significance": 0.7,
            "day_of_week": "Monday", (only for temporal types)
            "time_of_day": "evening", (only for temporal types)
          }}
        ]
        """

        openai_client = get_openai_client()

        # Use GPT-4 for more nuanced analysis when available
        try:
            model = "gpt-4o"
            response = await openai_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": f"Here is the conversation to analyze:\n\n{conversation_text}",
                    },
                ],
                temperature=0.2,  # Low temperature for consistent outputs
                max_tokens=1500,
            )
        except Exception as e:
            logger.warning(f"Error using GPT-4: {str(e)}. Falling back to GPT-3.5.")
            model = "gpt-3.5-turbo"
            response = await openai_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": f"Here is the conversation to analyze:\n\n{conversation_text}",
                    },
                ],
                temperature=0.3,
                max_tokens=1500,
            )

        response_text = response.choices[0].message.content
        logger.info(f"Profile extraction completed using {model}")

        # Extract JSON with fallbacks
        insights = extract_json_with_fallbacks(response_text)

        # Convert dictionaries to ExtractedInsight objects
        result = [
            ExtractedInsight.from_dict(insight)
            if isinstance(insight, dict)
            else insight
            for insight in insights
        ]
        
        # Log some statistics about extracted insights
        logger.info(f"Extracted {len(result)} insights with avg confidence: {sum(i.confidence for i in result)/max(1, len(result)):.2f}")
        
        return result

    except Exception as e:
        logger.error(f"Error extracting insights: {str(e)}")
        logger.exception("Detailed extraction error:")
        return []


def extract_json_with_improved_fallbacks(text: str) -> list[dict[str, Any]]:
    """Enhanced JSON extraction with better fallback strategies"""
    # First attempt: direct JSON parsing
    try:
        # Check if the text contains multiple JSON objects and extract them
        text = text.strip()
        # Find the first [ and last ] to extract the JSON array
        start_idx = text.find('[')
        end_idx = text.rfind(']')
        if start_idx != -1 and end_idx != -1:
            json_str = text[start_idx:end_idx + 1]
            data = json.loads(json_str)
            if isinstance(data, list):
                return data
    except json.JSONDecodeError:
        pass

    # Second attempt: fix common JSON syntax errors and try again
    try:
        # Replace single quotes with double quotes
        corrected_text = text.replace("'", '"')
        # Replace JavaScript-style trailing commas
        corrected_text = re.sub(r',\s*}', '}', corrected_text)
        corrected_text = re.sub(r',\s*]', ']', corrected_text)
        
        # Find JSON array pattern
        start_idx = corrected_text.find('[')
        end_idx = corrected_text.rfind(']')
        if start_idx != -1 and end_idx != -1:
            json_str = corrected_text[start_idx:end_idx + 1]
            data = json.loads(json_str)
            if isinstance(data, list):
                return data
    except json.JSONDecodeError:
        pass

    # Third attempt: find individual JSON objects and combine them
    object_pattern = r'\{\s*"type":\s*"[^"]+",.*?\}'
    object_matches = re.findall(object_pattern, text, re.DOTALL)
    if object_matches:
        insights = []
        for match in object_matches:
            try:
                # Fix common JSON syntax errors
                fixed_match = match.replace("'", '"')
                fixed_match = re.sub(r',\s*}', '}', fixed_match)
                insight = json.loads(fixed_match)
                insights.append(insight)
            except json.JSONDecodeError:
                continue
        if insights:
            return insights

    # Final fallback: extract key-value pairs using regex
    if not "type" in text and not "value" in text:
        logger.warning("No valid insights found in text")
        return []
    
    insights = []
    type_pattern = r'"type":\s*"([^"]+)"'
    value_pattern = r'"value":\s*"([^"]+)"'
    confidence_pattern = r'"confidence":\s*(0\.\d+)'
    significance_pattern = r'"emotional_significance":\s*(0\.\d+)'
    
    # Find all occurrences of type and value
    type_matches = re.findall(type_pattern, text)
    value_matches = re.findall(value_pattern, text)
    confidence_matches = re.findall(confidence_pattern, text)
    significance_matches = re.findall(significance_pattern, text)
    
    # Use the minimum length to avoid index errors
    min_length = min(len(type_matches), len(value_matches))
    
    for i in range(min_length):
        insight = {
            "type": type_matches[i],
            "value": value_matches[i],
            "confidence": float(confidence_matches[i]) if i < len(confidence_matches) else 0.7,
            "emotional_significance": float(significance_matches[i]) if i < len(significance_matches) else 0.7
        }
        insights.append(insight)
    
    return insights