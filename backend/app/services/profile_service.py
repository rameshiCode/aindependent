from app.profile import UserProfileModel, ProfileAttributeModel, AddictionType, RecoveryStage
from typing import Dict, Optional, Any
from datetime import datetime
import json
import os
from fastapi import HTTPException

class ProfileService:
    def __init__(self, storage_dir: str = "profiles/"):
        self.storage_dir = storage_dir
        os.makedirs(storage_dir, exist_ok=True)
    
    def get_profile(self, user_id: str) -> UserProfileModel:
        """Get user profile, loading from storage if needed"""
        try:
            return self._load_profile(user_id)
        except FileNotFoundError:
            # Create new profile
            profile = UserProfileModel(
                user_id=user_id,
                created_at=datetime.now(),
                last_updated=datetime.now()
            )
            self.save_profile(profile)
            return profile
    
    def save_profile(self, profile: UserProfileModel) -> bool:
        """Save profile to storage"""
        try:
            profile_path = os.path.join(self.storage_dir, f"{profile.user_id}.json")
            with open(profile_path, "w") as f:
                json.dump(profile.dict(), f, indent=2, default=str)
            return True
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error saving profile: {str(e)}")
    
    def _load_profile(self, user_id: str) -> UserProfileModel:
        """Load profile from storage"""
        profile_path = os.path.join(self.storage_dir, f"{user_id}.json")
        if not os.path.exists(profile_path):
            raise FileNotFoundError(f"Profile not found for user {user_id}")
        
        with open(profile_path, "r") as f:
            profile_data = json.load(f)
        
        # Convert string dates back to datetime
        for key, value in profile_data.items():
            if isinstance(value, dict) and "last_updated" in value:
                value["last_updated"] = datetime.fromisoformat(value["last_updated"])
        
        profile_data["created_at"] = datetime.fromisoformat(profile_data["created_at"])
        profile_data["last_updated"] = datetime.fromisoformat(profile_data["last_updated"])
        
        return UserProfileModel(**profile_data)
    
    def update_attribute(self, user_id: str, attr_name: str, value: Any, confidence: float) -> bool:
        """Update a specific attribute if confidence is higher"""
        profile = self.get_profile(user_id)
        
        # Check if attribute exists
        if not hasattr(profile, attr_name):
            raise HTTPException(status_code=400, detail=f"Attribute {attr_name} does not exist")
        
        # Get current attribute
        current_attr = getattr(profile, attr_name)
        
        # If attribute doesn't exist or new confidence is higher
        if current_attr is None or current_attr.confidence < confidence:
            # Create or update attribute
            new_attr = ProfileAttributeModel(
                value=value,
                confidence=confidence,
                last_updated=datetime.now()
            )
            setattr(profile, attr_name, new_attr)
            profile.last_updated = datetime.now()
            self.save_profile(profile)
            return True
        
        return False
