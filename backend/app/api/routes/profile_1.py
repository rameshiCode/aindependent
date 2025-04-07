from fastapi import APIRouter, Depends, HTTPException
from app.services.profile_service import ProfileService
from app.profile import UserProfileModel
from typing import Dict, Any

router = APIRouter()
profile_service = ProfileService()

@router.get("/profile/{user_id}", response_model=UserProfileModel)
async def get_profile(user_id: str):
    """Get user profile"""
    try:
        return profile_service.get_profile(user_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Profile not found")

@router.put("/profile/{user_id}/attribute")
async def update_attribute(user_id: str, attr_data: Dict[str, Any]):
    """Update a specific profile attribute"""
    if "name" not in attr_data or "value" not in attr_data or "confidence" not in attr_data:
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    try:
        success = profile_service.update_attribute(
            user_id, 
            attr_data["name"], 
            attr_data["value"], 
            attr_data["confidence"]
        )
        return {"success": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
