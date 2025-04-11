"""
Path: /app/services/profile_extractor.py
This file implements the profile extraction logic based on motivational interviewing principles.
It analyzes conversations and extracts insights about the user to build their profile.
"""

import logging
import uuid
from collections.abc import Callable
from datetime import datetime
import json
import re
from typing import Any, Dict, List, Optional, Tuple

from sqlmodel import Session, select

# Import models - make sure these imports match your project structure
from app.models import (
    Conversation,
    Message,
    UserInsight,
    UserProfile,
    UserGoal
)

# Set up logging
logger = logging.getLogger(__name__)

# Define constants for motivational interviewing stages
MI_STAGES = {
    "engaging": "Building rapport and establishing relationship",
    "focusing": "Identifying specific behaviors to change",
    "evoking": "Drawing out client's own motivations for change",
    "planning": "Developing commitment to change and specific plan",
}

# Define psychological trait keywords (expanded)
PSYCHOLOGICAL_TRAITS = {
    "need_for_approval": [
        "what do you think", "is that okay", "am i doing well", "did i do good",
        "is this right", "do you approve", "tell me if i'm wrong", "need validation",
        "want your opinion", "is this good enough"
    ],
    "fear_of_rejection": [
        "afraid to tell", "worried they'll", "they might leave", "they won't like me",
        "scared of what they'll think", "might lose them", "don't want to disappoint",
        "fear of being alone", "scared of rejection", "won't accept me"
    ],
    "low_self_confidence": [
        "i can't do it", "not good enough", "will fail", "don't trust myself",
        "always mess up", "never succeed", "too hard for me", "i'm not capable",
        "i'm too weak", "don't have what it takes", "others can but i can't"
    ],
    "submissiveness": [
        "whatever you think", "you decide", "i'll do what you say", "if you think so",
        "you know better", "i'll follow your advice", "tell me what to do",
        "you're in charge", "i trust your judgment", "i need you to tell me"
    ],
    "perfectionism": [
        "has to be perfect", "can't make mistakes", "everything must be right",
        "not good enough", "high standards", "must get it right", "failure is not an option"
    ],
    "impulsivity": [
        "couldn't help myself", "didn't think", "on impulse", "sudden urge",
        "without planning", "spontaneous", "just happened", "in the moment"
    ],
    "social_anxiety": [
        "nervous around people", "worried what others think", "feel judged",
        "hate social situations", "afraid to speak up", "uncomfortable in groups" 
    ],
}

# Define trigger categories (expanded)
TRIGGER_CATEGORIES = {
    "time": {
        "evening": "evening",
        "night": "night",
        "weekend": "weekend",
        "saturday": "saturday",
        "sunday": "sunday",
        "after work": "after work",
        "morning": "morning",
        "lunch": "lunch time",
        "friday": "friday night",
    },
    "emotional": {
        "stress": "stress",
        "anxious": "anxiety",
        "lonely": "loneliness",
        "bored": "boredom",
        "sad": "sadness",
        "depressed": "depression",
        "angry": "anger",
        "frustrated": "frustration",
        "tired": "fatigue",
        "overwhelmed": "feeling overwhelmed",
    },
    "social": {
        "friends": "friends",
        "party": "parties",
        "social": "social gatherings",
        "family": "family gatherings",
        "coworkers": "work colleagues",
        "celebration": "celebrations",
        "wedding": "weddings",
        "dating": "dating situations",
    },
    "situational": {
        "bar": "bars",
        "club": "clubs",
        "restaurant": "restaurants",
        "home alone": "being home alone",
        "work stress": "work pressure",
        "financial": "financial problems",
        "argument": "after arguments",
        "vacation": "vacations",
        "sports": "sporting events",
    },
}

# Define addiction types
ADDICTION_TYPES = {
    "alcohol": ["alcohol", "drink", "beer", "wine", "liquor", "drunk", "booze", "spirits"],
    "drugs": ["drugs", "substance", "cocaine", "heroin", "pills", "high", "weed", "marijuana", "meth", "opioids"],
    "gambling": ["gambling", "betting", "casino", "lottery", "slots", "poker", "sports betting", "online gambling"],
}

# Define recovery stages based on the Stages of Change model
RECOVERY_STAGES = {
    "precontemplation": [
        "don't have a problem", "not ready to change", "it's not that bad",
        "i can stop anytime", "others are exaggerating", "not addicted",
        "in control", "can handle it", "not harmful", "overreacting"
    ],
    "contemplation": [
        "thinking about changing", "considering quitting", "weighing pros and cons",
        "ambivalent", "part of me wants to", "might have a problem", 
        "concerned about", "should probably cut back", "sometimes wonder if"
    ],
    "preparation": [
        "planning to stop", "ready to change", "making a plan", "setting a date",
        "preparing to quit", "decided to cut back", "going to try",
        "taking steps toward", "researching how to", "getting ready"
    ],
    "action": [
        "started to change", "quit recently", "taking steps", "actively working",
        "in recovery", "making changes", "following my plan", "staying away from",
        "implementing strategies", "working on sobriety"
    ],
    "maintenance": [
        "been sober for", "maintaining sobriety", "staying clean", "continuing to",
        "long-term recovery", "lifestyle change", "established routine",
        "keeping on track", "managing triggers", "sustaining change"
    ],
}

# Define coping strategies
COPING_STRATEGIES = {
    "distraction": [
        "distract myself", "keep busy", "watch a movie", "go for a walk",
        "read a book", "find something else to do", "shift my attention"
    ],
    "social_support": [
        "call a friend", "talk to someone", "reach out", "support group",
        "sponsor", "family support", "therapist", "counselor"
    ],
    "physical_exercise": [
        "exercise", "workout", "go to the gym", "run", "walk", "physical activity",
        "sports", "swimming", "hiking", "biking"
    ],
    "mindfulness": [
        "meditation", "breathing exercises", "mindfulness", "grounding",
        "present moment", "focus on breath", "body scan", "yoga"
    ],
    "cognitive_reframing": [
        "think differently", "change my perspective", "look at the positives",
        "challenge thoughts", "reframe", "question my thinking", "positive self-talk"
    ],
    "avoidance": [
        "avoid triggers", "stay away from", "not go to", "decline invitations",
        "change route", "different friends", "new hangouts", "alternative activities"
    ],
    "replacement": [
        "substitute with", "replace with", "instead of", "alternative behavior",
        "healthier choice", "hobby", "new routine", "different habit"
    ]
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
        logger.info(f"Extracted conversation context: {conversation_context}")

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
            logger.info(f"Extracted addiction type: {addiction_type}")

        # Extract psychological traits
        logger.info("Extracting psychological traits...")
        traits = extract_psychological_traits(messages)
        logger.info(f"Extracted traits: {traits}")
        
        # Update psychological traits in profile
        if traits:
            if not profile.psychological_traits:
                profile.psychological_traits = {}
            
            # Merge with existing traits
            if isinstance(profile.psychological_traits, dict):
                profile.psychological_traits.update(traits)
            else:
                profile.psychological_traits = traits
                
        for trait, value in traits.items():
            insights.append(
                UserInsight(
                    user_id=uuid.UUID(user_id),
                    profile_id=profile.id,
                    conversation_id=uuid.UUID(conversation_id),
                    insight_type="psychological_trait",
                    value=f"{trait}:{value}",
                    confidence=0.7,
                    emotional_significance=0.6,
                )
            )

        # Extract triggers
        logger.info("Extracting triggers...")
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
        logger.info(f"Extracted triggers: {triggers}")

        # Extract coping strategies
        logger.info("Extracting coping strategies...")
        strategies = extract_coping_strategies(messages)
        for category, strategy_list in strategies.items():
            for strategy in strategy_list:
                insights.append(
                    UserInsight(
                        user_id=uuid.UUID(user_id),
                        profile_id=profile.id,
                        conversation_id=uuid.UUID(conversation_id),
                        insight_type="coping_strategy",
                        value=strategy,
                        emotional_significance=0.5,
                        confidence=0.65,
                    )
                )
        logger.info(f"Extracted coping strategies: {strategies}")

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
                    emotional_significance=0.7,
                )
            )

        # Extract MI stage from metadata
        mi_stage = extract_mi_stage_from_metadata(messages)
        if mi_stage:
            # Map MI stage to recovery stage
            recovery_stage = map_mi_to_recovery_stage(mi_stage)
            if recovery_stage and (
                not profile.recovery_stage or profile.recovery_stage != recovery_stage
            ):
                profile.recovery_stage = recovery_stage
                insights.append(
                    UserInsight(
                        user_id=uuid.UUID(user_id),
                        profile_id=profile.id,
                        conversation_id=uuid.UUID(conversation_id),
                        insight_type="recovery_stage",
                        value=recovery_stage,
                        confidence=0.8,
                        mi_stage=mi_stage,
                    )
                )
                logger.info(f"Extracted recovery stage from MI: {recovery_stage} (MI stage: {mi_stage})")

        # If no MI stage, try content-based recovery stage detection
        if not mi_stage:
            recovery_stage = extract_recovery_stage(messages)
            if recovery_stage and (
                not profile.recovery_stage or profile.recovery_stage != recovery_stage
            ):
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


def extract_mi_stage_from_metadata(messages: list[Message]) -> str | None:
    """
    Extract the MI stage from message metadata.
    
    Args:
        messages: List of messages in the conversation
        
    Returns:
        MI stage or None if not found
    """
    # Check the most recent messages first for stage information
    for message in reversed(messages):
        if hasattr(message, "message_metadata") and message.message_metadata:
            metadata = message.message_metadata
            
            # Different ways metadata might be structured
            if isinstance(metadata, dict) and "stage" in metadata:
                return metadata["stage"]
            elif hasattr(metadata, "get") and callable(metadata.get):
                try:
                    stage = metadata.get("stage")
                    if stage:
                        return stage
                except:
                    pass
            elif hasattr(metadata, "stage"):
                try:
                    return metadata.stage
                except:
                    pass
    
    return None


def map_mi_to_recovery_stage(mi_stage: str) -> str | None:
    """
    Map motivational interviewing stage to recovery stage.
    
    Args:
        mi_stage: Motivational interviewing stage
        
    Returns:
        Recovery stage or None if no mapping
    """
    # Mapping of MI stages to recovery stages
    mapping = {
        "engaging": "precontemplation",
        "focusing": "contemplation",
        "evoking": "preparation",
        "planning": "action",
    }
    
    return mapping.get(mi_stage)


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
    # Count occurrences of each addiction type
    addiction_counts = {addiction_type: 0 for addiction_type in ADDICTION_TYPES}
    
    # Look for addiction type keywords in all user messages
    for message in messages:
        if message.role == "user":
            content = message.content.lower()
            
            # Check for addiction types
            for addiction_type, keywords in ADDICTION_TYPES.items():
                for keyword in keywords:
                    if keyword in content:
                        addiction_counts[addiction_type] += 1
    
    # Return the addiction type with the most mentions, if any
    if any(addiction_counts.values()):
        return max(addiction_counts.items(), key=lambda x: x[1])[0]
    
    return None


def extract_psychological_traits(messages: list[Message]) -> dict[str, bool]:
    """
    Extract psychological traits from the conversation.

    Args:
        messages: List of messages in the conversation

    Returns:
        Dictionary mapping trait names to boolean values
    """
    traits = {}
    trait_counts = {trait: 0 for trait in PSYCHOLOGICAL_TRAITS}

    # Count occurrences of trait indicators in user messages
    for message in messages:
        if message.role == "user":
            content = message.content.lower()

            for trait, keywords in PSYCHOLOGICAL_TRAITS.items():
                if any(keyword in content for keyword in keywords):
                    trait_counts[trait] += 1

    # Set traits based on threshold counts
    for trait, count in trait_counts.items():
        # More than one occurrence is a stronger signal
        if count >= 1:
            traits[trait] = True

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


def extract_coping_strategies(messages: list[Message]) -> dict[str, list[str]]:
    """
    Extract coping strategies from the conversation.
    
    Args:
        messages: List of messages in the conversation
        
    Returns:
        Dictionary mapping strategy categories to lists of strategies
    """
    strategies = {category: [] for category in COPING_STRATEGIES}
    
    # Look for coping strategies in user messages
    for message in messages:
        if message.role == "user":
            content = message.content.lower()
            
            # Check for strategies in each category
            for category, keywords in COPING_STRATEGIES.items():
                for keyword in keywords:
                    if keyword in content:
                        # Extract the full phrase containing the strategy
                        sentences = re.split(r'[.!?]', content)
                        for sentence in sentences:
                            if keyword in sentence and sentence.strip() not in strategies[category]:
                                # Either use the sentence or a cleaned up version
                                value = sentence.strip()
                                # If the value is too long, extract just the relevant part
                                if len(value) > 100:
                                    value = extract_relevant_phrase(value, keyword)
                                if value and value not in strategies[category]:
                                    strategies[category].append(value)
    
    return strategies


def extract_relevant_phrase(text: str, keyword: str, max_length: int = 100) -> str:
    """
    Extract a relevant phrase containing a keyword from longer text.
    
    Args:
        text: The text to extract from
        keyword: The keyword to find
        max_length: Maximum length of the phrase to extract
        
    Returns:
        Extracted phrase
    """
    # Find the position of the keyword
    pos = text.find(keyword)
    if pos == -1:
        return text[:max_length]  # Fallback
        
    # Calculate start and end positions
    half_length = max_length // 2
    start = max(0, pos - half_length)
    end = min(len(text), pos + len(keyword) + half_length)
    
    # Adjust to avoid cutting words
    while start > 0 and text[start] != ' ':
        start -= 1
        
    while end < len(text) and text[end] != ' ':
        end += 1
        
    return text[start:end].strip()


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
    # Look for explicit numeric ratings
    for message in messages:
        if message.role == "user":
            content = message.content.lower()
            
            # Look for patterns like "on a scale of 1-10", "7/10", etc.
            patterns = [
                r"(?:on a|a|the|my)?\s*(?:scale|level|rating)(?:\s+of)?\s+(?:1[ -]to[ -]10|one[ -]to[ -]ten|1[ -]10|one[ -]ten)[\s,]*(?:i(?:'m| am)?)?\s*(?:a|about|around)?\s*(\d+)",
                r"(\d+)(?:\s+|\s*/\s*|\s+out\s+of\s+)(?:10|ten)",
                r"motivation(?:.*)(?:is|at|about)(?:.*)(\d+)(?:\s*/\s*|\s+out\s+of\s+)?(?:10|ten)?",
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, content)
                if matches:
                    try:
                        motivation = int(matches[0])
                        if 1 <= motivation <= 10:
                            return motivation
                    except (ValueError, TypeError):
                        pass
            
            # Look for descriptive phrases
            motivation_phrases = {
                "very motivated": 9,
                "highly motivated": 9,
                "quite motivated": 7,
                "somewhat motivated": 5,
                "a little motivated": 3,
                "not very motivated": 3,
                "not motivated": 2,
                "not at all motivated": 1,
                "extremely motivated": 10,
                "ready to change": 8,
                "willing to try": 6,
                "determined to": 8,
            }
            
            for phrase, level in motivation_phrases.items():
                if phrase in content:
                    return level

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


# Advanced profile extraction function that performs deep analysis
async def extract_profile_with_ai_analysis(
    conversation_messages: list[Message],
    session_factory: Callable[[], Session],
    user_id: str,
    conversation_id: str,
) -> dict:
    """
    Extract profile information using AI analysis of conversation.
    
    Args:
        conversation_messages: List of messages in the conversation
        session_factory: Function that returns a database session
        user_id: User ID
        conversation_id: Conversation ID
        
    Returns:
        Dictionary with extracted profile information
    """
    # First perform the standard extraction
    basic_results = {}
    
    # Get addiction type
    basic_results["addiction_type"] = extract_addiction_type(conversation_messages)
    
    # Get psychological traits
    basic_results["psychological_traits"] = extract_psychological_traits(conversation_messages)
    
    # Get recovery stage
    basic_results["recovery_stage"] = extract_recovery_stage(conversation_messages)
    
    # Get motivation level
    basic_results["motivation_level"] = extract_motivation_level(conversation_messages)
    
    # Get MI stage
    basic_results["mi_stage"] = extract_mi_stage_from_metadata(conversation_messages)
    
    # Get triggers
    basic_results["triggers"] = extract_triggers(conversation_messages)
    
    # Get coping strategies
    basic_results["coping_strategies"] = extract_coping_strategies(conversation_messages)
    
    # Create a summary from the basic results
    summary = {
        "addiction_type": basic_results["addiction_type"],
        "recovery_stage": basic_results["recovery_stage"] or map_mi_to_recovery_stage(basic_results["mi_stage"]) if basic_results["mi_stage"] else None,
        "motivation_level": basic_results["motivation_level"],
        "psychological_traits": list(basic_results["psychological_traits"].keys()) if basic_results["psychological_traits"] else [],
        "trigger_count": sum(len(triggers) for triggers in basic_results["triggers"].values()),
        "coping_strategy_count": sum(len(strategies) for strategies in basic_results["coping_strategies"].values()),
    }
    
    return {
        "basic_analysis": basic_results,
        "summary": summary
    }