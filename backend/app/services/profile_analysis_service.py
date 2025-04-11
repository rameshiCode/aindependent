import logging
from collections.abc import Callable
from typing import Any, Dict, List
from datetime import datetime
import json
import uuid

from sqlmodel import Session, select

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
        This uses advanced analysis to extract comprehensive profile information.
        """
        logger.info(f"Processing conversation {conversation_id} for structured output")
        
        try:
            # Get conversation messages
            session = self.session_factory()
            try:
                # First, get the conversation
                conversation = session.exec(
                    select(Conversation).where(Conversation.id == uuid.UUID(conversation_id))
                ).first()
                
                if not conversation:
                    return {"status": "error", "message": "Conversation not found"}
                
                # Get all messages for this conversation
                messages = session.exec(
                    select(Message)
                    .where(Message.conversation_id == uuid.UUID(conversation_id))
                    .order_by(Message.created_at)
                ).all()
                
                if not messages:
                    return {"status": "error", "message": "No messages found in conversation"}
                
                # Process through structured extraction
                structured_data = await self.extract_structured_profile(messages)
                
                # Update the user profile with this data
                updated_profile = await self.update_profile_from_structured_data(
                    user_id, structured_data, session
                )
                
                # Return the combined data
                return {
                    "status": "success",
                    "profile": structured_data,
                    "profile_updated": True,
                    "last_updated": updated_profile.last_updated.isoformat() if updated_profile else None
                }
                
            finally:
                session.close()
                
        except Exception as e:
            logger.error(f"Error in structured profile extraction: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            
            return {
                "status": "error",
                "message": str(e)
            }
    
    async def extract_structured_profile(self, messages: list[Message]) -> dict:
        """
        Extract a structured profile using OpenAI from conversation messages.
        
        Args:
            messages: List of messages in the conversation
            
        Returns:
            Structured profile data as a dictionary
        """
        # Format conversation for analysis
        formatted_conversation = self._format_conversation_for_analysis(messages)
        
        # Create the specialized extraction prompt
        system_prompt = """You are an expert psychologist specializing in addiction recovery and motivational interviewing.
        Analyze the following conversation between a therapist and a client. 
        Extract structured information about the client and return it as a JSON object with the following structure:
        
        {
          "basic_info": {
            "addiction_type": string | null,
            "recovery_stage": "precontemplation" | "contemplation" | "preparation" | "action" | "maintenance",
            "abstinence_days": number | null
          },
          "psychological_traits": {
            "need_for_approval": boolean,
            "fear_of_rejection": boolean,
            "low_self_confidence": boolean,
            "submissiveness": boolean,
            "other_traits": [string]
          },
          "motivation": {
            "level": number (1-10),
            "internal_motivators": [string],
            "external_motivators": [string],
            "ambivalence_factors": [string]
          },
          "triggers": {
            "emotional": [string],
            "situational": [string],
            "social": [string],
            "time_based": {
              "days": [string],
              "times": [string]
            }
          },
          "coping_strategies": {
            "currently_using": [string],
            "potential_strategies": [string]
          },
          "goals": {
            "short_term": [string],
            "long_term": [string],
            "commitments_made": [string]
          },
          "risk_factors": {
            "immediate_risks": [string],
            "long_term_risks": [string],
            "protective_factors": [string]
          },
          "analysis": {
            "key_insights": [string],
            "recommended_focus": string,
            "confidence_level": number (0-1)
          }
        }
        
        Include only fields where you have reasonable confidence. Leave arrays empty if no information is available.
        Base your analysis on concrete evidence from the conversation, not assumptions.
        """
        
        # Get messages for OpenAI
        messages_for_api = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Here is the conversation to analyze:\n\n{formatted_conversation}"}
        ]
        
        # Call OpenAI API
        # Import the call_openai_with_fallback from your openai.py module
        from app.api.routes.openai import call_openai_with_fallback
        
        completion = await call_openai_with_fallback(
            messages_for_api,
            requested_model="gpt-4o",
            max_retries=1,
        )
        
        # Parse and validate the JSON response
        try:
            content = completion.choices[0].message.content
            # Try to extract JSON if it's wrapped in ```json or ```
            if "```json" in content:
                json_text = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                json_text = content.split("```")[1].split("```")[0].strip()
            else:
                json_text = content
                
            profile_data = json.loads(json_text)
            validated_data = self._validate_profile_data(profile_data)
            return validated_data
        except Exception as e:
            logger.error(f"Error parsing profile data: {str(e)}")
            logger.error(f"Raw content: {completion.choices[0].message.content}")
            # Return a minimal valid structure if parsing fails
            return {
                "basic_info": {},
                "psychological_traits": {},
                "motivation": {},
                "triggers": {},
                "coping_strategies": {},
                "goals": {},
                "risk_factors": {},
                "analysis": {
                    "key_insights": ["Failed to extract structured profile"],
                    "confidence_level": 0
                }
            }
    
    def _format_conversation_for_analysis(self, messages: list[Message]) -> str:
        """Format conversation messages for analysis"""
        formatted = []
        
        for message in messages:
            role = "Therapist" if message.role == "assistant" else "Client"
            formatted.append(f"{role}: {message.content}")
            
        return "\n\n".join(formatted)
    
    def _validate_profile_data(self, data: dict) -> dict:
        """Validate and clean up the profile data structure"""
        # Create a base structure with empty values
        validated = {
            "basic_info": {},
            "psychological_traits": {},
            "motivation": {},
            "triggers": {},
            "coping_strategies": {},
            "goals": {},
            "risk_factors": {},
            "analysis": {}
        }
        
        # Basic info validation
        if "basic_info" in data:
            validated["basic_info"] = {
                "addiction_type": data["basic_info"].get("addiction_type"),
                "recovery_stage": data["basic_info"].get("recovery_stage"),
                "abstinence_days": data["basic_info"].get("abstinence_days")
            }
        
        # Psychological traits validation
        if "psychological_traits" in data:
            validated["psychological_traits"] = {
                "need_for_approval": data["psychological_traits"].get("need_for_approval", False),
                "fear_of_rejection": data["psychological_traits"].get("fear_of_rejection", False),
                "low_self_confidence": data["psychological_traits"].get("low_self_confidence", False),
                "submissiveness": data["psychological_traits"].get("submissiveness", False),
                "other_traits": data["psychological_traits"].get("other_traits", [])
            }
        
        # Add other sections similarly...
        if "motivation" in data:
            validated["motivation"] = {
                "level": data["motivation"].get("level"),
                "internal_motivators": data["motivation"].get("internal_motivators", []),
                "external_motivators": data["motivation"].get("external_motivators", []),
                "ambivalence_factors": data["motivation"].get("ambivalence_factors", [])
            }
        
        if "triggers" in data:
            validated["triggers"] = {
                "emotional": data["triggers"].get("emotional", []),
                "situational": data["triggers"].get("situational", []),
                "social": data["triggers"].get("social", []),
                "time_based": {
                    "days": data["triggers"].get("time_based", {}).get("days", []),
                    "times": data["triggers"].get("time_based", {}).get("times", [])
                }
            }
        
        if "coping_strategies" in data:
            validated["coping_strategies"] = {
                "currently_using": data["coping_strategies"].get("currently_using", []),
                "potential_strategies": data["coping_strategies"].get("potential_strategies", [])
            }
        
        if "goals" in data:
            validated["goals"] = {
                "short_term": data["goals"].get("short_term", []),
                "long_term": data["goals"].get("long_term", []),
                "commitments_made": data["goals"].get("commitments_made", [])
            }
        
        if "risk_factors" in data:
            validated["risk_factors"] = {
                "immediate_risks": data["risk_factors"].get("immediate_risks", []),
                "long_term_risks": data["risk_factors"].get("long_term_risks", []),
                "protective_factors": data["risk_factors"].get("protective_factors", [])
            }
        
        if "analysis" in data:
            validated["analysis"] = {
                "key_insights": data["analysis"].get("key_insights", []),
                "recommended_focus": data["analysis"].get("recommended_focus", ""),
                "confidence_level": data["analysis"].get("confidence_level", 0.5)
            }
        
        return validated
    
    async def update_profile_from_structured_data(
        self, 
        user_id: str, 
        structured_data: dict, 
        session
    ) -> UserProfile:
        """
        Update the user profile with structured data
        
        Args:
            user_id: User ID
            structured_data: Structured profile data
            session: Database session
            
        Returns:
            Updated user profile
        """
        # Get or create profile
        profile = session.exec(
            select(UserProfile).where(UserProfile.user_id == uuid.UUID(user_id))
        ).first()
        
        if not profile:
            profile = UserProfile(user_id=uuid.UUID(user_id))
            session.add(profile)
        
        # Update basic info
        if "basic_info" in structured_data:
            if structured_data["basic_info"].get("addiction_type"):
                profile.addiction_type = structured_data["basic_info"]["addiction_type"]
            
            if structured_data["basic_info"].get("recovery_stage"):
                profile.recovery_stage = structured_data["basic_info"]["recovery_stage"]
            
            if structured_data["basic_info"].get("abstinence_days") is not None:
                profile.abstinence_days = structured_data["basic_info"]["abstinence_days"]
        
        # Update psychological traits
        if "psychological_traits" in structured_data:
            # Create or update the psychological_traits dict
            if not profile.psychological_traits:
                profile.psychological_traits = {}
            
            # Extract boolean traits
            trait_updates = {
                k: v for k, v in structured_data["psychological_traits"].items() 
                if k in ["need_for_approval", "fear_of_rejection", "low_self_confidence", "submissiveness"]
                and isinstance(v, bool)
            }
            
            # Update profile traits (merge with existing)
            if isinstance(profile.psychological_traits, dict):
                profile.psychological_traits.update(trait_updates)
            else:
                profile.psychological_traits = trait_updates
        
        # Update motivation level
        if "motivation" in structured_data and structured_data["motivation"].get("level") is not None:
            profile.motivation_level = structured_data["motivation"]["level"]
        
        # Set confidence and timestamp
        if "analysis" in structured_data and "confidence_level" in structured_data["analysis"]:
            # You might add this field to your UserProfile model
            # profile.profile_confidence = structured_data["analysis"]["confidence_level"]
            pass
        
        profile.last_updated = datetime.utcnow()
        
        # Save profile
        session.add(profile)
        session.commit()
        session.refresh(profile)
        
        # Create insights from structured data
        await self._create_insights_from_structured_data(user_id, profile.id, structured_data, session)
        
        return profile
    
    async def _create_insights_from_structured_data(
        self, 
        user_id: str, 
        profile_id: uuid.UUID, 
        structured_data: dict, 
        session
    ):
        """Create UserInsight records from the structured data"""
        # Example: Create insights for psychological traits
        if "psychological_traits" in structured_data:
            for trait, value in structured_data["psychological_traits"].items():
                if trait != "other_traits" and isinstance(value, bool) and value:
                    insight = UserInsight(
                        user_id=uuid.UUID(user_id),
                        profile_id=profile_id,
                        insight_type="psychological_trait",
                        value=f"{trait}:true",
                        confidence=0.8,
                        emotional_significance=0.7,
                        extracted_at=datetime.utcnow()
                    )
                    session.add(insight)
            
            # Add other traits
            for trait in structured_data["psychological_traits"].get("other_traits", []):
                insight = UserInsight(
                    user_id=uuid.UUID(user_id),
                    profile_id=profile_id,
                    insight_type="psychological_trait",
                    value=trait,
                    confidence=0.7,
                    emotional_significance=0.6,
                    extracted_at=datetime.utcnow()
                )
                session.add(insight)
        
        # Example: Create insights for triggers
        if "triggers" in structured_data:
            # Emotional triggers
            for trigger in structured_data["triggers"].get("emotional", []):
                insight = UserInsight(
                    user_id=uuid.UUID(user_id),
                    profile_id=profile_id,
                    insight_type="trigger",
                    value=trigger,
                    confidence=0.8,
                    emotional_significance=0.7,
                    extracted_at=datetime.utcnow()
                )
                session.add(insight)
            
            # Time-based triggers with day/time context
            for day in structured_data["triggers"].get("time_based", {}).get("days", []):
                insight = UserInsight(
                    user_id=uuid.UUID(user_id),
                    profile_id=profile_id,
                    insight_type="trigger",
                    value=f"day: {day}",
                    day_of_week=day.lower(),
                    confidence=0.8,
                    emotional_significance=0.7,
                    extracted_at=datetime.utcnow()
                )
                session.add(insight)
            
            for time in structured_data["triggers"].get("time_based", {}).get("times", []):
                insight = UserInsight(
                    user_id=uuid.UUID(user_id),
                    profile_id=profile_id,
                    insight_type="trigger",
                    value=f"time: {time}",
                    time_of_day=time.lower(),
                    confidence=0.8,
                    emotional_significance=0.7,
                    extracted_at=datetime.utcnow()
                )
                session.add(insight)
        
        # Create insights for coping strategies
        if "coping_strategies" in structured_data:
            for strategy in structured_data["coping_strategies"].get("currently_using", []):
                insight = UserInsight(
                    user_id=uuid.UUID(user_id),
                    profile_id=profile_id,
                    insight_type="coping_strategy",
                    value=strategy,
                    confidence=0.8,
                    emotional_significance=0.6,
                    extracted_at=datetime.utcnow()
                )
                session.add(insight)
        
        # Create key insights
        if "analysis" in structured_data and "key_insights" in structured_data["analysis"]:
            for i, insight_text in enumerate(structured_data["analysis"]["key_insights"]):
                insight = UserInsight(
                    user_id=uuid.UUID(user_id),
                    profile_id=profile_id,
                    insight_type="key_insight",
                    value=insight_text,
                    confidence=structured_data["analysis"].get("confidence_level", 0.7),
                    emotional_significance=0.8,
                    extracted_at=datetime.utcnow()
                )
                session.add(insight)
        
        # Commit all insights
        session.commit()
    
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