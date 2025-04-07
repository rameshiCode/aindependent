from fastapi import APIRouter

from app.api.routes.openai import OpenAIService
from app.services.conversation_analyzer import ConversationAnalyzer
from app.services.profile_service import ProfileService

router = APIRouter()
openai_service = OpenAIService()
profile_service = ProfileService()
conversation_analyzer = ConversationAnalyzer(profile_service)


@router.post("/chat/{user_id}")
async def chat(user_id: str, message: dict):
    """Process a chat message and analyze it for profile information"""
    # Process message with OpenAI
    response = await openai_service.process_message(user_id, message)

    # Analyze user message for profile information
    conversation_analyzer.analyze_message(user_id, message)

    # Analyze AI response for conversation stage
    conversation_analyzer.analyze_message(user_id, response)

    return response


@router.post("/chat/{user_id}/end")
async def end_chat(user_id: str):
    """End the conversation and perform comprehensive profile analysis"""
    success = conversation_analyzer.end_conversation(user_id)
    return {"success": success}
