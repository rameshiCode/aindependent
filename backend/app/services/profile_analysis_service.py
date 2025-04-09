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

            return {
                "message_analyzed": True,
                "insights": insights,
                "current_profile": profile.dict(),
            }

        except Exception as e:
            logger.error(f"Error analyzing message: {str(e)}")
            return {"status": "error", "message": str(e)}

    async def end_conversation_analysis(self, user_id: str) -> dict[str, Any]:
        """
        Finalize analysis when a conversation ends.

        Args:
            user_id: The ID of the user

        Returns:
            Dictionary with results of the finalized analysis
        """
        logger.info(f"Ending conversation analysis for user {user_id}")

        try:
            # End the conversation in the analyzer
            result = self.conversation_analyzer.end_conversation(user_id)

            # Get updated profile
            profile = self.profile_service.get_profile(user_id)

            return {"analysis_completed": result, "profile": profile.dict()}

        except Exception as e:
            logger.error(f"Error ending conversation analysis: {str(e)}")
            return {"status": "error", "message": str(e)}
