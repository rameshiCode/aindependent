import logging
from collections.abc import Callable
from typing import Any

from sqlmodel import Session

from app.services.conversation_analyzer import ConversationAnalyzer
from app.services.profile_extractor import process_conversation_for_profile
from app.services.profile_service import ProfileService

logger = logging.getLogger(__name__)


class ProfileAnalysisService:
    """
    Service for analyzing conversations and messages to build user profiles.
    Serves as a facade over ConversationAnalyzer and ProfileService.
    """

    def __init__(self, session_factory: Callable[[], Session]):
        self.session_factory = session_factory
        self.profile_service = ProfileService()
        self.conversation_analyzer = ConversationAnalyzer(self.profile_service)

    async def process_conversation(
        self,
        conversation_id: str,
        user_id: str,
        is_goal_accepted: bool = False,
        goal_description: str = None,
    ) -> dict[str, Any]:
        """
        Process a full conversation to extract profile information.

        Args:
            conversation_id: The ID of the conversation to process
            user_id: The ID of the user
            is_goal_accepted: Whether a goal was accepted in this conversation
            goal_description: Description of the accepted goal, if any

        Returns:
            Dictionary with processing results
        """
        logger.info(f"Processing conversation {conversation_id} for user {user_id}")

        try:
            # Use the background process_conversation_for_profile function
            await process_conversation_for_profile(
                self.session_factory,
                conversation_id,
                user_id,
                is_goal_accepted,
                goal_description,
            )

            # Get updated profile
            profile = self.profile_service.get_profile(user_id)

            return {
                "status": "success",
                "conversation_id": conversation_id,
                "profile_updated": True,
                "profile": profile.dict(),
            }

        except Exception as e:
            logger.error(f"Error processing conversation: {str(e)}")
            return {
                "status": "error",
                "conversation_id": conversation_id,
                "message": str(e),
            }

    async def analyze_message(
        self, user_id: str, message: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Analyze a single message in real-time to extract profile insights.

        Args:
            user_id: The ID of the user
            message: The message content and metadata

        Returns:
            Dictionary with extracted insights
        """
        logger.info(f"Analyzing message for user {user_id}")

        try:
            # Use conversation analyzer to process the message
            insights = self.conversation_analyzer.analyze_message(user_id, message)

            # Get current profile
            profile = self.profile_service.get_profile(user_id)

            # Extract and store the MI stage if available in metadata
            mi_stage = None
            if message.get("metadata") and "stage" in message.get("metadata", {}):
                mi_stage = message["metadata"]["stage"]
                
                # Update the recovery stage in the profile based on MI stage
                if mi_stage == "engaging":
                    recovery_stage = "precontemplation"
                elif mi_stage == "focusing":
                    recovery_stage = "contemplation"
                elif mi_stage == "evoking":
                    recovery_stage = "preparation"
                elif mi_stage == "planning":
                    recovery_stage = "action"
                else:
                    recovery_stage = None
                    
                # Only update if we have a mapping
                if recovery_stage:
                    self.profile_service.update_attribute(
                        user_id, "recovery_stage", recovery_stage, 0.8
                    )

            return {
                "message_analyzed": True,
                "insights": insights,
                "mi_stage": mi_stage,
                "current_profile": profile.dict(),
            }

        except Exception as e:
            logger.error(f"Error analyzing message: {str(e)}")
            return {"status": "error", "message": str(e)}