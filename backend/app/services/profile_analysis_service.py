import logging
from collections.abc import Callable
from typing import Any, Dict, List
from datetime import datetime

from sqlmodel import Session, select
import uuid

from app.models import UserProfile, UserInsight, Conversation, Message

logger = logging.getLogger(__name__)

class ProfileAnalysisService:
    """
    Service for analyzing conversations and messages to build user profiles.
    Serves as a facade over ConversationAnalyzer and ProfileService.
    """

    def __init__(self, session_factory: Callable[[], Session]):
        self.session_factory = session_factory
        from app.services.profile_service import ProfileService
        from app.services.conversation_analyzer import ConversationAnalyzer
        
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
            from app.services.profile_extractor import process_conversation_for_profile
            
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

    async def process_conversation_with_structured_output(
        self,
        conversation_id: str,
        user_id: str,
        is_goal_accepted: bool = False,
        goal_description: str = None,
    ) -> dict[str, Any]:
        """
        Process a conversation and return structured profile data for immediate use.
        
        Args:
            conversation_id: The ID of the conversation to process
            user_id: The ID of the user
            is_goal_accepted: Whether a goal was accepted
            goal_description: Description of the accepted goal, if any
            
        Returns:
            Dictionary with structured profile data and insights
        """
        logger.info(f"Processing conversation {conversation_id} for structured output")
        
        try:
            # First, process the conversation as normal
            from app.services.profile_extractor import process_conversation_for_profile
            
            await process_conversation_for_profile(
                self.session_factory,
                conversation_id,
                user_id,
                is_goal_accepted,
                goal_description,
            )
            
            # Create a new session to fetch results
            session = self.session_factory()
            
            try:
                # Get the profile
                profile = session.exec(
                    select(UserProfile).where(UserProfile.user_id == uuid.UUID(user_id))
                ).first()
                
                if not profile:
                    return {
                        "status": "error", 
                        "message": "Profile not found"
                    }
                
                # Get all insights for this user
                insights = session.exec(
                    select(UserInsight)
                    .where(UserInsight.user_id == uuid.UUID(user_id))
                    .order_by(UserInsight.extracted_at.desc())
                ).all()
                
                # Get conversation-specific insights
                conversation_insights = session.exec(
                    select(UserInsight)
                    .where(UserInsight.user_id == uuid.UUID(user_id))
                    .where(UserInsight.conversation_id == uuid.UUID(conversation_id))
                    .order_by(UserInsight.extracted_at.desc())
                ).all()
                
                # Group insights by type
                grouped_insights = {}
                for insight in insights:
                    if insight.insight_type not in grouped_insights:
                        grouped_insights[insight.insight_type] = []
                    
                    grouped_insights[insight.insight_type].append({
                        "value": insight.value,
                        "confidence": insight.confidence,
                        "day_of_week": insight.day_of_week,
                        "time_of_day": insight.time_of_day,
                        "extracted_at": insight.extracted_at.isoformat() if insight.extracted_at else None,
                        "emotional_significance": insight.emotional_significance
                    })
                
                # Extract key values for the profile
                psychological_traits = {}
                for insight in insights:
                    if insight.insight_type == "psychological_trait":
                        if ":" in insight.value:
                            key, value = insight.value.split(":", 1)
                            psychological_traits[key] = value.lower() == "true"
                
                # Structure the data
                result = {
                    "profile": {
                        "addiction_type": profile.addiction_type,
                        "recovery_stage": profile.recovery_stage,
                        "motivation_level": profile.motivation_level,
                        "abstinence_days": profile.abstinence_days,
                        "abstinence_start_date": profile.abstinence_start_date.isoformat() 
                            if profile.abstinence_start_date else None,
                        "psychological_traits": psychological_traits or profile.psychological_traits,
                        "last_updated": profile.last_updated.isoformat() if profile.last_updated else None,
                    },
                    "insights": grouped_insights,
                    "conversation_insights": [
                        {
                            "type": insight.insight_type,
                            "value": insight.value,
                            "confidence": insight.confidence,
                            "day_of_week": insight.day_of_week,
                            "time_of_day": insight.time_of_day,
                        }
                        for insight in conversation_insights
                    ],
                    "summary": {
                        "recovery_stage": profile.recovery_stage,
                        "motivation_level": profile.motivation_level,
                        "trigger_count": len(grouped_insights.get("trigger", [])),
                        "psychological_trait_count": len(grouped_insights.get("psychological_trait", [])),
                        "coping_strategy_count": len(grouped_insights.get("coping_strategy", [])),
                    }
                }
                
                # Add MI stage insights
                result["motivational_interviewing"] = self._extract_mi_stage_info(conversation_id, session)
                
                return result
            
            finally:
                session.close()
                
        except Exception as e:
            logger.error(f"Error processing conversation for structured output: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            
            return {
                "status": "error",
                "message": str(e)
            }
    
    def _extract_mi_stage_info(self, conversation_id: str, session: Session) -> dict:
        """Extract motivational interviewing stage information from conversation"""
        try:
            # Get messages for this conversation
            messages = session.exec(
                select(Message)
                .where(Message.conversation_id == uuid.UUID(conversation_id))
                .order_by(Message.created_at)
            ).all()
            
            stages_visited = set()
            current_stage = None
            
            # Track stages in metadata
            for message in messages:
                if hasattr(message, "message_metadata") and message.message_metadata:
                    metadata = message.message_metadata
                    
                    if isinstance(metadata, dict) and "stage" in metadata:
                        stage = metadata["stage"]
                        stages_visited.add(stage)
                        current_stage = stage
            
            return {
                "current_stage": current_stage,
                "stages_visited": list(stages_visited),
                "message_count": len(messages),
            }
            
        except Exception as e:
            logger.error(f"Error extracting MI stage info: {str(e)}")
            return {
                "current_stage": None,
                "stages_visited": [],
                "error": str(e)
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