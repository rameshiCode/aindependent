from app.services.profile_service import ProfileService
from app.models.profile import AddictionType, RecoveryStage
from typing import Dict, List, Any
import re

class ConversationAnalyzer:
    def __init__(self, profile_service: ProfileService):
        self.profile_service = profile_service
        self.current_conversations = {}  # Track active conversations
    
    def analyze_message(self, user_id: str, message: Dict):
        """Analyze a single message in real-time"""
        # Get or create conversation context
        if user_id not in self.current_conversations:
            self.current_conversations[user_id] = {
                "messages": [],
                "current_stage": None,
                "extracted_data": {}
            }
        
        conversation = self.current_conversations[user_id]
        conversation["messages"].append(message)
        
        # Extract stage information if available
        if "stage" in message:
            conversation["current_stage"] = message["stage"]
        
        # Perform lightweight analysis during conversation
        self._extract_basic_information(user_id, message, conversation)
    
    def end_conversation(self, user_id: str) -> bool:
        """Process end of conversation and update profile"""
        if user_id not in self.current_conversations:
            return False
        
        conversation = self.current_conversations[user_id]
        
        # Perform comprehensive analysis
        self._analyze_full_conversation(user_id, conversation)
        
        # Clear conversation data
        del self.current_conversations[user_id]
        
        return True
    
    def _extract_basic_information(self, user_id: str, message: Dict, conversation: Dict):
        """Extract basic information during conversation"""
        # This would be a lightweight analysis to capture critical information
        # Example implementation for addiction type detection
        if conversation["current_stage"] == "tip_dependenta" and "text" in message:
            text = message["text"].lower()
            
            # Simple keyword matching
            if any(word in text for word in ["alcohol", "drink", "beer", "wine"]):
                self.profile_service.update_attribute(
                    user_id, "addiction_type", AddictionType.ALCOHOL, 0.7
                )
            elif any(word in text for word in ["drug", "substance", "cocaine", "heroin"]):
                self.profile_service.update_attribute(
                    user_id, "addiction_type", AddictionType.DRUGS, 0.7
                )
            elif any(word in text for word in ["gambling", "betting", "casino"]):
                self.profile_service.update_attribute(
                    user_id, "addiction_type", AddictionType.GAMBLING, 0.7
                )
    
    def _analyze_full_conversation(self, user_id: str, conversation: Dict):
        """Perform comprehensive analysis at end of conversation"""
        messages = conversation["messages"]
        
        # Extract psychological traits
        self._extract_psychological_traits(user_id, messages)
        
        # Extract triggers
        self._extract_triggers(user_id, messages)
        
        # Extract motivation level
        self._extract_motivation(user_id, messages)
        
        # Determine recovery stage
        self._determine_recovery_stage(user_id, messages)
        
        # Extract notification keywords
        self._extract_notification_keywords(user_id, messages)
    
    def _extract_psychological_traits(self, user_id: str, messages: List[Dict]):
        """Extract psychological traits from conversation"""
        # Check for need for approval
        approval_keywords = ["what do you think", "is that okay", "am i doing well", "did i do good"]
        approval_count = sum(1 for msg in messages if "text" in msg and 
                            any(keyword in msg["text"].lower() for keyword in approval_keywords))
        
        if approval_count >= 3:  # If multiple instances found
            self.profile_service.update_attribute(user_id, "need_for_approval", True, 0.8)
        
        # Check for fear of rejection
        rejection_keywords = ["afraid to tell", "worried they'll", "they might leave", "they won't like me"]
        rejection_count = sum(1 for msg in messages if "text" in msg and 
                             any(keyword in msg["text"].lower() for keyword in rejection_keywords))
        
        if rejection_count >= 2:
            self.profile_service.update_attribute(user_id, "fear_of_rejection", True, 0.8)
        
        # Check for low self-confidence
        confidence_keywords = ["i can't do it", "not good enough", "will fail", "don't trust myself"]
        confidence_count = sum(1 for msg in messages if "text" in msg and 
                              any(keyword in msg["text"].lower() for keyword in confidence_keywords))
        
        if confidence_count >= 2:
            self.profile_service.update_attribute(user_id, "low_self_confidence", True, 0.8)
        
        # Check for submissiveness
        submissive_keywords = ["whatever you think", "you decide", "i'll do what you say", "if you think so"]
        submissive_count = sum(1 for msg in messages if "text" in msg and 
                              any(keyword in msg["text"].lower() for keyword in submissive_keywords))
        
        if submissive_count >= 2:
            self.profile_service.update_attribute(user_id, "submissiveness", True, 0.8)
    
    # Additional methods for extracting triggers, motivation, recovery stage, etc.
    # (Implementation similar to the Python example provided earlier)
