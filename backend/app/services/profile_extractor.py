"""
Path: /app/services/profile_extractor.py
This file implements the profile extraction logic based on motivational interviewing principles.
It analyzes conversations and extracts insights about the user to build their profile.
"""

import logging
import uuid
from collections.abc import Callable
from datetime import datetime
from typing import Any

from sqlmodel import Session, select

# Import models - adjust these imports based on your actual project structure
from app.models import (
    Conversation,
    Message,
    UserInsight,
    UserProfile,
)

# Set up logging
logger = logging.getLogger(__name__)

# Define constants for motivational interviewing stages
MI_STAGES = {
    "introducere": "engaging",
    "tip_dependenta": "focusing",
    "motivatie": "evoking",
    "ambivalenta": "evoking",
    "plan_schimbare": "planning",
    "suport_recadere": "planning",
    "abstinenta": "focusing",
    "anxietate": "evoking",
    "familie": "focusing",
    "tentatii": "evoking",
    "feedback": "planning",
}

# Define psychological trait keywords
PSYCHOLOGICAL_TRAITS = {
    "need_for_approval": [
        "what do you think",
        "is that okay",
        "am i doing well",
        "did i do good",
        "is this right",
        "do you approve",
        "tell me if i'm wrong",
    ],
    "fear_of_rejection": [
        "afraid to tell",
        "worried they'll",
        "they might leave",
        "they won't like me",
        "scared of what they'll think",
        "might lose them",
        "don't want to disappoint",
    ],
    "low_self_confidence": [
        "i can't do it",
        "not good enough",
        "will fail",
        "don't trust myself",
        "always mess up",
        "never succeed",
        "too hard for me",
    ],
    "submissiveness": [
        "whatever you think",
        "you decide",
        "i'll do what you say",
        "if you think so",
        "you know better",
        "i'll follow your advice",
        "tell me what to do",
    ],
}

# Define trigger keywords
TRIGGER_CATEGORIES = {
    "time": {
        "evening": "evening",
        "night": "night",
        "weekend": "weekend",
        "saturday": "saturday",
        "sunday": "sunday",
        "after work": "after work",
    },
    "emotional": {
        "stress": "stress",
        "anxious": "anxiety",
        "lonely": "loneliness",
        "bored": "boredom",
        "sad": "sadness",
        "depressed": "depression",
        "angry": "anger",
    },
    "social": {
        "friends": "friends",
        "party": "parties",
        "social": "social gatherings",
        "family": "family gatherings",
    },
    "situational": {
        "bar": "bars",
        "club": "clubs",
        "restaurant": "restaurants",
        "home alone": "being home alone",
    },
}

# Define addiction types
ADDICTION_TYPES = {
    "alcohol": ["alcohol", "drink", "beer", "wine", "liquor", "drunk"],
    "drugs": ["drugs", "substance", "cocaine", "heroin", "pills", "high"],
    "gambling": ["gambling", "betting", "casino", "lottery", "slots", "poker"],
}

# Define recovery stages based on the Stages of Change model
RECOVERY_STAGES = {
    "precontemplation": [
        "don't have a problem",
        "not ready to change",
        "it's not that bad",
        "i can stop anytime",
        "others are exaggerating",
    ],
    "contemplation": [
        "thinking about changing",
        "considering quitting",
        "weighing pros and cons",
        "ambivalent",
        "part of me wants to",
    ],
    "preparation": [
        "planning to stop",
        "ready to change",
        "making a plan",
        "setting a date",
        "preparing to quit",
    ],
    "action": [
        "started to change",
        "quit recently",
        "taking steps",
        "actively working",
        "in recovery",
    ],
    "maintenance": [
        "been sober for",
        "maintaining sobriety",
        "staying clean",
        "continuing to",
        "long-term recovery",
    ],
}


async def process_conversation_for_profile(
    session_factory: Callable[[], Session],
    conversation_id: str,
    user_id: str,
    is_goal_accepted: bool = False,
    goal_description: str | None = None,
):
    """
    Process a conversation to extract profile information.
    This function is designed to be run as a background task.

    Args:
        session_factory: A function that returns a new database session
        conversation_id: The ID of the conversation to process
        user_id: The ID of the user who owns the conversation
        is_goal_accepted: Whether a goal was accepted in this conversation
        goal_description: The description of the accepted goal if any
    """
    logger.info(
        f"Starting profile extraction for conversation {conversation_id}, user {user_id}"
    )
    try:
        # Create a new session
        session = session_factory()

        # Get the conversation and messages
        conversation = session.exec(
            select(Conversation).where(Conversation.id == uuid.UUID(conversation_id))
        ).first()

        if not conversation:
            logger.error(f"Conversation {conversation_id} not found")
            return

        messages = session.exec(
            select(Message)
            .where(Message.conversation_id == uuid.UUID(conversation_id))
            .order_by(Message.created_at)
        ).all()

        if not messages:
            logger.warning(f"No messages found for conversation {conversation_id}")
            return

        logger.info(f"Processing {len(messages)} messages for profile extraction")

        # Get or create user profile
        profile = session.exec(
            select(UserProfile).where(UserProfile.user_id == uuid.UUID(user_id))
        ).first()

        if not profile:
            logger.info(f"Creating new profile for user {user_id}")
            profile = UserProfile(user_id=uuid.UUID(user_id))
            session.add(profile)
            session.commit()
            session.refresh(profile)

        # Process messages to extract profile information
        insights = []

        # Extract conversation context
        conversation_context = extract_conversation_context(messages)

        # Extract addiction type
        addiction_type = extract_addiction_type(messages)
        if addiction_type and (
            not profile.addiction_type or profile.addiction_type != addiction_type
        ):
            profile.addiction_type = addiction_type
            insights.append(
                UserInsight(
                    user_id=uuid.UUID(user_id),
                    profile_id=profile.id,
                    conversation_id=uuid.UUID(conversation_id),
                    insight_type="addiction_type",
                    value=addiction_type,
                    confidence=0.8,
                )
            )

        # Extract psychological traits
        logger.info("Extracting psychological traits...")
        traits = extract_psychological_traits(messages)
        logger.info(f"Extracted traits: {traits}")
        for trait, value in traits.items():
            insights.append(
                UserInsight(
                    user_id=uuid.UUID(user_id),
                    profile_id=profile.id,
                    conversation_id=uuid.UUID(conversation_id),
                    insight_type="psychological_trait",
                    value=f"{trait}:{value}",
                    confidence=0.7,
                )
            )

        # Extract triggers
        triggers = extract_triggers(messages)
        for category, trigger_list in triggers.items():
            for trigger in trigger_list:
                insights.append(
                    UserInsight(
                        user_id=uuid.UUID(user_id),
                        profile_id=profile.id,
                        conversation_id=uuid.UUID(conversation_id),
                        insight_type="trigger",
                        value=trigger,
                        day_of_week=extract_day_of_week(trigger, messages)
                        if category == "time"
                        else None,
                        time_of_day=extract_time_of_day(trigger, messages)
                        if category == "time"
                        else None,
                        emotional_significance=0.6,
                        confidence=0.7,
                    )
                )

        # Extract motivation level
        logger.info("Extracting motivation level...")
        motivation_level = extract_motivation_level(messages)
        logger.info(f"Extracted motivation level: {motivation_level}")
        if motivation_level and (
            not profile.motivation_level or profile.motivation_level != motivation_level
        ):
            profile.motivation_level = motivation_level
            insights.append(
                UserInsight(
                    user_id=uuid.UUID(user_id),
                    profile_id=profile.id,
                    conversation_id=uuid.UUID(conversation_id),
                    insight_type="motivation",
                    value=f"Motivation level: {motivation_level}/10",
                    confidence=0.8,
                )
            )

        # Extract recovery stage
        recovery_stage = extract_recovery_stage(messages)
        if recovery_stage:
            # If a goal was accepted, update the recovery stage to action
            if is_goal_accepted and recovery_stage != "action":
                recovery_stage = "action"
                profile.recovery_stage = recovery_stage

            insights.append(
                UserInsight(
                    user_id=uuid.UUID(user_id),
                    profile_id=profile.id,
                    conversation_id=uuid.UUID(conversation_id),
                    insight_type="recovery_stage",
                    value=recovery_stage,
                    confidence=0.7,
                )
            )

        # Extract notification keywords
        notification_keywords = extract_notification_keywords(messages)
        for keyword in notification_keywords:
            insights.append(
                UserInsight(
                    user_id=uuid.UUID(user_id),
                    profile_id=profile.id,
                    conversation_id=uuid.UUID(conversation_id),
                    insight_type="notification_keyword",
                    value=keyword,
                    confidence=0.6,
                )
            )

        # If a goal was accepted, create specific goal-related insights
        if is_goal_accepted and goal_description:
            # Add a goal acceptance insight
            insights.append(
                UserInsight(
                    user_id=uuid.UUID(user_id),
                    profile_id=profile.id,
                    conversation_id=uuid.UUID(conversation_id),
                    insight_type="goal_acceptance",
                    value=goal_description,
                    emotional_significance=0.8,
                    confidence=0.9,
                )
            )

            # Update the recovery stage to action
            profile.recovery_stage = "action"

            # Increase motivation level if it's below 7
            if not profile.motivation_level or profile.motivation_level < 7:
                profile.motivation_level = 7

            # Extract potential deadline or timeframe from goal
            goal_timeframe = extract_timeframe_from_goal(goal_description)
            if goal_timeframe:
                insights.append(
                    UserInsight(
                        user_id=uuid.UUID(user_id),
                        profile_id=profile.id,
                        conversation_id=uuid.UUID(conversation_id),
                        insight_type="goal_timeframe",
                        value=goal_timeframe,
                        confidence=0.7,
                    )
                )

        # Update profile last_updated timestamp
        profile.last_updated = datetime.utcnow()

        # Save insights and profile updates
        for insight in insights:
            logger.info(f"Saving insight: {insight.insight_type} - {insight.value}")
            session.add(insight)

        session.add(profile)
        session.commit()

        logger.info(f"Processed conversation {conversation_id} for user {user_id}")
        logger.info(f"Added {len(insights)} insights")

    except Exception as e:
        logger.error(f"Error processing conversation: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
    finally:
        # Close the session
        session.close()


def extract_timeframe_from_goal(goal_description: str) -> str | None:
    """
    Extract timeframe information from a goal description.
    Returns timeframe string or None if not found.
    """
    goal_lower = goal_description.lower()

    # Look for timeframe patterns
    timeframe_patterns = [
        r"(today|tomorrow|this week|this month|next week|next month)",
        r"within (\d+) (day|days|week|weeks|month|months)",
        r"for (\d+) (day|days|week|weeks|month|months)",
        r"by (monday|tuesday|wednesday|thursday|friday|saturday|sunday)",
        r"until (january|february|march|april|may|june|july|august|september|october|november|december)",
    ]

    for pattern in timeframe_patterns:
        import re

        match = re.search(pattern, goal_lower)
        if match:
            return match.group(0)

    return None


def extract_conversation_context(messages: list[Message]) -> dict[str, Any]:
    """
    Extract the context of the conversation, including the current stage.

    Args:
        messages: List of messages in the conversation

    Returns:
        Dictionary containing conversation context
    """
    context = {
        "current_stage": None,
        "stages_visited": [],
    }

    for message in messages:
        # Check if message has stage information in metadata
        if hasattr(message, "message_metadata") and message.message_metadata:
            # Handle different types of metadata
            metadata = message.message_metadata
            stage = None

            if isinstance(metadata, dict):
                stage = metadata.get("stage")
            elif hasattr(metadata, "get"):
                # If it has get method but isn't a dict
                stage = metadata.get("stage")
            elif hasattr(metadata, "stage"):
                # Direct attribute access
                stage = metadata.stage

            # If we found a stage, add it to context
            if stage:
                if stage not in context["stages_visited"]:
                    context["stages_visited"].append(stage)
                context["current_stage"] = stage

    return context


def extract_addiction_type(messages: list[Message]) -> str | None:
    """
    Extract the addiction type from the conversation.

    Args:
        messages: List of messages in the conversation

    Returns:
        Addiction type or None if not found
    """
    # Look for explicit addiction type in messages with stage "tip_dependenta"
    for message in messages:
        if (
            hasattr(message, "metadata")
            and message.metadata
            and hasattr(message.metadata, "stage")
            and message.metadata.stage == "tip_dependenta"
            and message.role == "user"
        ):
            content = message.content.lower()

            # Check for addiction types
            for addiction_type, keywords in ADDICTION_TYPES.items():
                if any(keyword in content for keyword in keywords):
                    return addiction_type

    # If no explicit mention in the right stage, check all user messages
    for message in messages:
        if message.role == "user":
            content = message.content.lower()

            # Check for addiction types
            for addiction_type, keywords in ADDICTION_TYPES.items():
                if any(keyword in content for keyword in keywords):
                    return addiction_type

    return None


def extract_psychological_traits(messages: list[Message]) -> dict[str, bool]:
    """
    Extract psychological traits from the conversation.

    Args:
        messages: List of messages in the conversation

    Returns:
        Dictionary mapping trait names to boolean values
    """
    traits = {
        "need_for_approval": False,
        "fear_of_rejection": False,
        "low_self_confidence": False,
        "submissiveness": False,
    }

    trait_counts = {trait: 0 for trait in traits}

    # Count occurrences of trait indicators in user messages
    for message in messages:
        if message.role == "user":
            content = message.content.lower()

            for trait, keywords in PSYCHOLOGICAL_TRAITS.items():
                if any(keyword in content for keyword in keywords):
                    trait_counts[trait] += 1

    # Set traits based on threshold counts
    if trait_counts["need_for_approval"] >= 1:
        traits["need_for_approval"] = True

    if trait_counts["fear_of_rejection"] >= 1:
        traits["fear_of_rejection"] = True

    if trait_counts["low_self_confidence"] >= 1:
        traits["low_self_confidence"] = True

    if trait_counts["submissiveness"] >= 1:
        traits["submissiveness"] = True

    return traits


def extract_triggers(messages: list[Message]) -> dict[str, list[str]]:
    """
    Extract triggers from the conversation.

    Args:
        messages: List of messages in the conversation

    Returns:
        Dictionary mapping trigger categories to lists of triggers
    """
    triggers = {
        "time": [],
        "emotional": [],
        "social": [],
        "situational": [],
    }

    # Look for triggers in user messages
    for message in messages:
        if message.role == "user":
            content = message.content.lower()

            # Check for triggers in each category
            for category, keywords in TRIGGER_CATEGORIES.items():
                for keyword, value in keywords.items():
                    if keyword in content and value not in triggers[category]:
                        triggers[category].append(value)

    return triggers


def extract_day_of_week(trigger: str, messages: list[Message]) -> str | None:
    """
    Extract the day of week associated with a trigger.

    Args:
        trigger: The trigger to find the day for
        messages: List of messages in the conversation

    Returns:
        Day of week or None if not found
    """
    days = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ]

    for message in messages:
        if message.role == "user" and trigger.lower() in message.content.lower():
            content = message.content.lower()

            for day in days:
                if day in content:
                    return day

    return None


def extract_time_of_day(trigger: str, messages: list[Message]) -> str | None:
    """
    Extract the time of day associated with a trigger.

    Args:
        trigger: The trigger to find the time for
        messages: List of messages in the conversation

    Returns:
        Time of day or None if not found
    """
    times = ["morning", "afternoon", "evening", "night"]

    for message in messages:
        if message.role == "user" and trigger.lower() in message.content.lower():
            content = message.content.lower()

            for time in times:
                if time in content:
                    return time

    return None


def extract_motivation_level(messages: list[Message]) -> int | None:
    """
    Extract the motivation level from the conversation.

    Args:
        messages: List of messages in the conversation

    Returns:
        Motivation level (1-10) or None if not found
    """
    # Look for motivation level in messages with stage "motivatie" or "evoking"
    for message in messages:
        if message.role == "user":
            # Check if metadata exists and has the stage attribute
            if hasattr(message, "message_metadata") and message.message_metadata:
                # Convert to dict if it's not already
                metadata = message.message_metadata
                if isinstance(metadata, dict):
                    stage = metadata.get("stage")
                elif hasattr(metadata, "get"):
                    # If it has get method but isn't a dict
                    stage = metadata.get("stage")
                elif hasattr(metadata, "stage"):
                    # Direct attribute access
                    stage = metadata.stage
                else:
                    stage = None

                # Check if the stage is one where motivation might be discussed
                if stage in ["motivatie", "evoking"]:
                    content = message.content.lower()
                    # Look for numeric rating
                    if (
                        "scale" in content
                        or "scară" in content
                        or "out of 10" in content
                        or "from 1 to 10" in content
                    ):
                        import re

                        numbers = re.findall(r"\b([1-9]|10)\b", content)
                        if numbers:
                            try:
                                motivation = int(numbers[0])
                                if 1 <= motivation <= 10:
                                    return motivation
                            except ValueError:
                                pass

            # Even without proper metadata, check content for motivation scale mentions
            content = message.content.lower()
            if ("scale" in content or "on a scale" in content) and (
                "motivation" in content or "important" in content or "ready" in content
            ):
                import re

                numbers = re.findall(r"\b([1-9]|10)\b", content)
                if numbers:
                    try:
                        motivation = int(numbers[0])
                        if 1 <= motivation <= 10:
                            return motivation
                    except ValueError:
                        pass

    return None


def extract_recovery_stage(messages: list[Message]) -> str | None:
    """
    Extract the recovery stage from the conversation.

    Args:
        messages: List of messages in the conversation

    Returns:
        Recovery stage or None if not found
    """
    stage_counts = {stage: 0 for stage in RECOVERY_STAGES}

    # Count indicators for each stage in user messages
    for message in messages:
        if message.role == "user":
            content = message.content.lower()

            for stage, indicators in RECOVERY_STAGES.items():
                for indicator in indicators:
                    if indicator in content:
                        stage_counts[stage] += 1

    # Return the stage with the most indicators, if any
    if any(stage_counts.values()):
        return max(stage_counts.items(), key=lambda x: x[1])[0]

    return None


def extract_notification_keywords(messages: list[Message]) -> list[str]:
    """
    Extract keywords for notifications from the conversation.

    Args:
        messages: List of messages in the conversation

    Returns:
        List of notification keywords
    """
    keywords = []

    # Look for day-specific activities
    days = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ]
    activities = ["club", "bar", "party", "drink", "use", "meet", "go out"]

    for message in messages:
        if message.role == "user":
            content = message.content.lower()

            for day in days:
                if day in content:
                    for activity in activities:
                        if activity in content and f"{day}:{activity}" not in keywords:
                            keywords.append(f"{day}:{activity}")

    # Look for time-specific activities
    times = ["morning", "afternoon", "evening", "night", "after work"]
    activities = ["drink", "use", "craving", "urge", "temptation"]

    for message in messages:
        if message.role == "user":
            content = message.content.lower()

            for time in times:
                if time in content:
                    for activity in activities:
                        if activity in content and f"{time}:{activity}" not in keywords:
                            keywords.append(f"{time}:{activity}")

    return keywords


def get_metadata_value(message: Message, key: str) -> Any:
    """
    Safely extract a value from message metadata, handling different types.

    Args:
        message: The message object
        key: The metadata key to look for

    Returns:
        The value if found, None otherwise
    """
    if not hasattr(message, "message_metadata") or not message.message_metadata:
        return None

    metadata = message.message_metadata

    # Handle different metadata types
    if isinstance(metadata, dict):
        return metadata.get(key)
    elif hasattr(metadata, "get"):
        # If it has get method but isn't a dict
        try:
            return metadata.get(key)
        except:
            pass
    elif hasattr(metadata, key):
        # Direct attribute access
        try:
            return getattr(metadata, key)
        except:
            pass

    return None
