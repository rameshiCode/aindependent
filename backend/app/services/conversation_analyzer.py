import logging
import re
from typing import Any

from app.models import (  # RecoveryStage is here in case you expand later
    AddictionType,
)
from app.services.profile_service import ProfileService

logger = logging.getLogger(__name__)


class ConversationAnalyzer:
    def __init__(self, profile_service: ProfileService):
        self.profile_service = profile_service
        self.current_conversations: dict[
            str, dict[str, Any]
        ] = {}  # Tracks active conversations

    def analyze_message(self, user_id: str, message: dict):
        """Analyze a single message in real-time."""
        if user_id not in self.current_conversations:
            self.current_conversations[user_id] = {
                "messages": [],
                "current_stage": None,
                "extracted_data": {},
            }
        conversation = self.current_conversations[user_id]
        conversation["messages"].append(message)
        if "stage" in message:
            conversation["current_stage"] = message["stage"]
        self._extract_basic_information(user_id, message, conversation)

    def end_conversation(self, user_id: str) -> bool:
        """Process end of conversation and update profile."""
        if user_id not in self.current_conversations:
            return False
        conversation = self.current_conversations[user_id]
        self._analyze_full_conversation(user_id, conversation)
        del self.current_conversations[user_id]
        return True

    def _extract_basic_information(
        self, user_id: str, message: dict, conversation: dict
    ):
        """Extract basic information during conversation (e.g., addiction type detection)."""
        # Use "text" if available; otherwise, fallback to "content"
        message_text = message.get("text") or message.get("content", "")
        if conversation.get("current_stage") == "tip_dependenta" and message_text:
            text = message_text.lower()
            # Simple keyword matching for addiction type
            if any(word in text for word in ["alcohol", "drink", "beer", "wine"]):
                self.profile_service.update_attribute(
                    user_id, "addiction_type", AddictionType.ALCOHOL, 0.7
                )
            elif any(
                word in text for word in ["drug", "substance", "cocaine", "heroin"]
            ):
                self.profile_service.update_attribute(
                    user_id, "addiction_type", AddictionType.DRUGS, 0.7
                )
            elif any(word in text for word in ["gambling", "betting", "casino"]):
                self.profile_service.update_attribute(
                    user_id, "addiction_type", AddictionType.GAMBLING, 0.7
                )

    def _extract_triggers(self, user_id: str, messages: list[dict]):
        """Extract triggers from conversation based on keyword matching."""
        logger.info(f"Extracting triggers for user {user_id}")
        trigger_keywords = [
            "stress",
            "lonely",
            "party",
            "home alone",
            "evening",
            "night",
        ]
        found_triggers = []
        for msg in messages:
            text = (msg.get("text") or msg.get("content", "")).lower()
            for keyword in trigger_keywords:
                if keyword in text and keyword not in found_triggers:
                    found_triggers.append(keyword)
        if found_triggers:
            self.profile_service.update_attribute(
                user_id, "triggers", found_triggers, 0.7
            )
            logger.info(f"Found triggers: {found_triggers}")
        else:
            logger.info("No triggers found.")

    def _extract_motivation(self, user_id: str, messages: list[dict]):
        """Extract motivation level from conversation."""
        logger.info(f"Extracting motivation level for user {user_id}")
        combined_text = " ".join(
            [msg.get("text") or msg.get("content", "") for msg in messages]
        ).lower()
        # Look for a pattern like "5/10" or "5 out of 10"
        match = re.search(r"(\d+)\s*(?:\/\s*10|out of 10)", combined_text)
        if match:
            level = int(match.group(1))
            self.profile_service.update_attribute(
                user_id, "motivation_level", level, 0.8
            )
            logger.info(f"Extracted motivation level: {level}")
        else:
            logger.info("No motivation level extracted.")

    def _extract_psychological_traits(self, user_id: str, messages: list[dict]):
        """Extract psychological traits from conversation based on keyword matching."""
        logger.info(f"Extracting psychological traits for user {user_id}")

        # Helper function: get lower-case text from message.
        def get_text(msg: dict) -> str:
            return (msg.get("text") or msg.get("content", "")).lower()

        # Need for approval
        approval_keywords = [
            "what do you think",
            "is that okay",
            "am i doing well",
            "did i do good",
        ]
        approval_count = sum(
            1
            for msg in messages
            if any(keyword in get_text(msg) for keyword in approval_keywords)
        )
        logger.info(f"Approval count: {approval_count}")
        if approval_count >= 3:
            self.profile_service.update_attribute(
                user_id, "need_for_approval", True, 0.8
            )
            logger.info("Updated need_for_approval to True")

        # Fear of rejection
        rejection_keywords = [
            "afraid to tell",
            "worried they'll",
            "they might leave",
            "they won't like me",
        ]
        rejection_count = sum(
            1
            for msg in messages
            if any(keyword in get_text(msg) for keyword in rejection_keywords)
        )
        logger.info(f"Rejection count: {rejection_count}")
        if rejection_count >= 2:
            self.profile_service.update_attribute(
                user_id, "fear_of_rejection", True, 0.8
            )
            logger.info("Updated fear_of_rejection to True")

        # Low self-confidence
        confidence_keywords = [
            "i can't do it",
            "not good enough",
            "will fail",
            "don't trust myself",
        ]
        confidence_count = sum(
            1
            for msg in messages
            if any(keyword in get_text(msg) for keyword in confidence_keywords)
        )
        logger.info(f"Confidence count: {confidence_count}")
        if confidence_count >= 2:
            self.profile_service.update_attribute(
                user_id, "low_self_confidence", True, 0.8
            )
            logger.info("Updated low_self_confidence to True")

        # Submissiveness
        submissive_keywords = [
            "whatever you think",
            "you decide",
            "i'll do what you say",
            "if you think so",
        ]
        submissive_count = sum(
            1
            for msg in messages
            if any(keyword in get_text(msg) for keyword in submissive_keywords)
        )
        logger.info(f"Submissiveness count: {submissive_count}")
        if submissive_count >= 2:
            self.profile_service.update_attribute(user_id, "submissiveness", True, 0.8)
            logger.info("Updated submissiveness to True")

    def _determine_recovery_stage(self, user_id: str, messages: list[dict]):
        """Determine recovery stage based on conversation content (stub implementation)."""
        logger.info(f"Determining recovery stage for user {user_id}")
        # For now, simply default to "contemplation". Later logic might analyze specific phrases.
        default_stage = "contemplation"
        self.profile_service.update_attribute(
            user_id, "recovery_stage", default_stage, 0.7
        )
        logger.info(f"Set recovery stage to default: {default_stage}")

    def _extract_notification_keywords(self, user_id: str, messages: list[dict]):
        """Extract keywords that might trigger notifications (stub implementation)."""
        logger.info(f"Extracting notification keywords for user {user_id}")
        keywords_to_check = ["remind", "later", "urgent"]
        found_keywords = []
        for msg in messages:
            text = (msg.get("text") or msg.get("content", "")).lower()
            for keyword in keywords_to_check:
                if keyword in text and keyword not in found_keywords:
                    found_keywords.append(keyword)
        if found_keywords:
            self.profile_service.update_attribute(
                user_id, "notification_keywords", found_keywords, 0.7
            )
            logger.info(f"Extracted notification keywords: {found_keywords}")
        else:
            logger.info("No notification keywords extracted.")

    def _analyze_full_conversation(self, user_id: str, conversation: dict):
        """Perform comprehensive analysis at the end of the conversation."""
        messages = conversation.get("messages", [])
        self._extract_psychological_traits(user_id, messages)
        self._extract_triggers(user_id, messages)
        self._extract_motivation(user_id, messages)
        self._determine_recovery_stage(user_id, messages)
        self._extract_notification_keywords(user_id, messages)
