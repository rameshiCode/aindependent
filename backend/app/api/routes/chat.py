from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.deps import get_db, get_current_user
from app.api.routes.openai import call_openai_with_fallback, get_openai_client
from app.services.conversation_analyzer import ConversationAnalyzer
from app.services.profile_service import ProfileService

router = APIRouter()
profile_service = ProfileService()
conversation_analyzer = ConversationAnalyzer(profile_service)


@router.post("/chat/{user_id}")
async def chat(user_id: str, message: dict, db: Session = Depends(get_db)):
    """Process a chat message and analyze it for profile information"""
    # Use existing functions from openai.py
    client = get_openai_client()
    
    # Format messages for OpenAI
    messages_for_api = [
        {
            "role": "system",
            "content": "You are a caring, empathetic AI therapist helping people overcome addiction."
        },
        {
            "role": "user", 
            "content": message.get("content", "")
        }
    ]
    
    completion = await call_openai_with_fallback(
        messages_for_api,
        requested_model="gpt-3.5-turbo",
        max_retries=3,
    )

    response = {
        "role": "assistant",
        "content": completion.choices[0].message.content
    }

    # Analyze messages for profile information
    conversation_analyzer.analyze_message(user_id, message)
    conversation_analyzer.analyze_message(user_id, response)

    return response


@router.post("/chat/{user_id}/end")
async def end_chat(user_id: str):
    """End the conversation and perform comprehensive profile analysis"""
    success = conversation_analyzer.end_conversation(user_id)
    return {"success": success}
