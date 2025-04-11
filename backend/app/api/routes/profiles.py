# app/api/routes/profiles.py
import traceback
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, HTTPException, logger, status
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import Conversation, Message, UserGoal, UserInsight, UserProfile
from app.services.profile_analysis_service import ProfileAnalysisService
from sqlmodel import Session
from app.core.db import engine

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("/my-profile", response_model=dict)
def get_my_profile(session: SessionDep, current_user: CurrentUser):
    """Get the current user's profile including insights summary"""
    profile = session.exec(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    ).first()

    if not profile:
        # Create a default profile if none exists
        profile = UserProfile(user_id=current_user.id)
        session.add(profile)
        session.commit()
        session.refresh(profile)

    # Get top insights
    insights = session.exec(
        select(UserInsight)
        .where(UserInsight.user_id == current_user.id)
        .order_by(UserInsight.emotional_significance.desc())
        .limit(10)
    ).all()

    # Get active goals
    goals = session.exec(
        select(UserGoal)
        .where(UserGoal.user_id == current_user.id)
        .where(UserGoal.status == "active")
    ).all()

    # Format response
    return {
        "id": str(profile.id),
        "addiction_type": profile.addiction_type,
        "abstinence_days": profile.abstinence_days,
        "abstinence_start_date": profile.abstinence_start_date.isoformat()
        if profile.abstinence_start_date
        else None,
        "motivation_level": profile.motivation_level,
        "recovery_stage": profile.recovery_stage,
        "psychological_traits": profile.psychological_traits,
        "insights": [
            {
                "id": str(insight.id),
                "type": insight.insight_type,
                "value": insight.value,
                "significance": insight.emotional_significance,
            }
            for insight in insights
        ],
        "goals": [
            {
                "id": str(goal.id),
                "description": goal.description,
                "created_at": goal.created_at.isoformat(),
                "target_date": goal.target_date.isoformat()
                if goal.target_date
                else None,
                "status": goal.status,
            }
            for goal in goals
        ],
        "last_updated": profile.last_updated.isoformat(),
    }


@router.post("/update-abstinence", response_model=dict)
def update_abstinence_status(
    data: dict, session: SessionDep, current_user: CurrentUser
):
    """Update the user's abstinence status"""
    profile = session.exec(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    ).first()

    if not profile:
        profile = UserProfile(user_id=current_user.id)
        session.add(profile)
        session.commit()
        session.refresh(profile)

    # Handle reset (relapse)
    if data.get("reset") is True:
        profile.abstinence_days = 0
        profile.abstinence_start_date = datetime.utcnow()

        # Add insight about relapse
        insight = UserInsight(
            user_id=current_user.id,
            profile_id=profile.id,  # Make sure to link the insight to the profile
            insight_type="abstinence",
            value="User reported a relapse and reset their abstinence counter.",
            emotional_significance=0.8,
            confidence=1.0,
        )
        session.add(insight)

    # Handle manually setting days
    elif "days" in data:
        try:
            days = int(data["days"])
            if days < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Abstinence days cannot be negative",
                )

            profile.abstinence_days = days

            # Update start date based on days
            from datetime import timedelta

            profile.abstinence_start_date = datetime.utcnow() - timedelta(days=days)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Days must be a valid number",
            )

    profile.last_updated = datetime.utcnow()
    session.add(profile)
    session.commit()

    return {
        "abstinence_days": profile.abstinence_days,
        "abstinence_start_date": profile.abstinence_start_date.isoformat()
        if profile.abstinence_start_date
        else None,
        "last_updated": profile.last_updated.isoformat(),
    }


@router.get("/goals", response_model=list[dict])
def get_user_goals(
    session: SessionDep, current_user: CurrentUser, status: str | None = None
):
    """Get goals for the current user, optionally filtered by status"""
    query = select(UserGoal).where(UserGoal.user_id == current_user.id)

    if status:
        query = query.where(UserGoal.status == status)

    query = query.order_by(UserGoal.created_at.desc())
    goals = session.exec(query).all()

    return [
        {
            "id": str(goal.id),
            "description": goal.description,
            "created_at": goal.created_at.isoformat(),
            "target_date": goal.target_date.isoformat() if goal.target_date else None,
            "status": goal.status,
        }
        for goal in goals
    ]


@router.put("/goals/{goal_id}", response_model=dict)
def update_user_goal(
    goal_id: uuid.UUID, goal_data: dict, session: SessionDep, current_user: CurrentUser
):
    """Update an existing goal"""
    goal = session.exec(
        select(UserGoal)
        .where(UserGoal.id == goal_id)
        .where(UserGoal.user_id == current_user.id)
    ).first()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )

    # Update status if provided
    if "status" in goal_data:
        if goal_data["status"] in ["active", "completed", "abandoned"]:
            goal.status = goal_data["status"]
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status. Must be 'active', 'completed', or 'abandoned'",
            )

    # Update target date if provided
    if "target_date" in goal_data:
        try:
            if goal_data["target_date"]:
                goal.target_date = datetime.fromisoformat(goal_data["target_date"])
            else:
                goal.target_date = None
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use ISO format (YYYY-MM-DD).",
            )

    # Update description if provided
    if "description" in goal_data:
        goal.description = goal_data["description"]

    session.add(goal)
    session.commit()

    return {
        "id": str(goal.id),
        "description": goal.description,
        "created_at": goal.created_at.isoformat(),
        "target_date": goal.target_date.isoformat() if goal.target_date else None,
        "status": goal.status,
    }


@router.post("/goals", response_model=dict)
def create_user_goal(goal_data: dict, session: SessionDep, current_user: CurrentUser):
    """Create a new goal for the user"""
    if not goal_data.get("description"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Goal description is required",
        )

    goal = UserGoal(
        user_id=current_user.id, description=goal_data["description"], status="active"
    )

    # Add target date if provided
    if "target_date" in goal_data and goal_data["target_date"]:
        try:
            goal.target_date = datetime.fromisoformat(goal_data["target_date"])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use ISO format (YYYY-MM-DD).",
            )

    session.add(goal)
    session.commit()
    session.refresh(goal)

    return {
        "id": str(goal.id),
        "description": goal.description,
        "created_at": goal.created_at.isoformat(),
        "target_date": goal.target_date.isoformat() if goal.target_date else None,
        "status": goal.status,
    }


@router.get("/insights", response_model=list[dict])
def get_user_insights(
    session: SessionDep,
    current_user: CurrentUser,
    insight_type: str | None = None,
    limit: int = 10,
):
    """Get insights for the current user, optionally filtered by type"""
    query = select(UserInsight).where(UserInsight.user_id == current_user.id)

    if insight_type:
        query = query.where(UserInsight.insight_type == insight_type)

    query = query.order_by(UserInsight.extracted_at.desc()).limit(limit)
    insights = session.exec(query).all()

    return [
        {
            "id": str(insight.id),
            "type": insight.insight_type,
            "value": insight.value,
            "significance": insight.emotional_significance,
            "confidence": insight.confidence,
            "extracted_at": insight.extracted_at.isoformat(),
            "day_of_week": insight.day_of_week,
            "time_of_day": insight.time_of_day,
        }
        for insight in insights
    ]


@router.get("/profile-attribute/{attribute_name}", response_model=dict)
def get_profile_attribute(
    attribute_name: str, session: SessionDep, current_user: CurrentUser
):
    """Get a specific profile attribute"""
    profile = session.exec(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    ).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found"
        )

    # Check if the attribute exists
    if not hasattr(profile, attribute_name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid attribute name: {attribute_name}",
        )

    # Get the attribute value
    value = getattr(profile, attribute_name)

    return {
        "name": attribute_name,
        "value": value,
        "last_updated": profile.last_updated.isoformat(),
    }


@router.put("/profile-attribute/{attribute_name}", response_model=dict)
def update_profile_attribute(
    attribute_name: str, data: dict, session: SessionDep, current_user: CurrentUser
):
    """Update a specific profile attribute"""
    if "value" not in data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required field: value",
        )

    profile = session.exec(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    ).first()

    if not profile:
        # Create profile if it doesn't exist
        profile = UserProfile(user_id=current_user.id)
        session.add(profile)
        session.commit()
        session.refresh(profile)

    # Check if the attribute exists
    if not hasattr(profile, attribute_name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid attribute name: {attribute_name}",
        )

    # Update the attribute
    setattr(profile, attribute_name, data["value"])
    profile.last_updated = datetime.utcnow()

    # Create an insight if confidence is provided
    if "confidence" in data and data["confidence"] is not None:
        insight = UserInsight(
            user_id=current_user.id,
            profile_id=profile.id,
            insight_type=f"profile_attribute_{attribute_name}",
            value=str(data["value"]),
            confidence=float(data["confidence"]),
            extracted_at=datetime.utcnow(),
        )
        session.add(insight)

    session.add(profile)
    session.commit()

    return {
        "name": attribute_name,
        "value": data["value"],
        "last_updated": profile.last_updated.isoformat(),
    }


@router.post("/force-profile-extraction/{conversation_id}")
async def force_profile_extraction(
    conversation_id: str,
    background_tasks: BackgroundTasks,
    session: SessionDep,
    current_user: CurrentUser,
):
    """Force profile extraction for a specific conversation"""
    from sqlmodel import Session

    from app.core.db import engine
    from app.services.profile_analysis_service import ProfileAnalysisService

    # Verify the conversation exists and belongs to the user
    conversation = session.exec(
        select(Conversation)
        .where(Conversation.id == uuid.UUID(conversation_id))
        .where(Conversation.user_id == current_user.id)
    ).first()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or doesn't belong to you",
        )

    # Count the messages in the conversation
    message_count = session.exec(
        select(func.count(Message.id)).where(
            Message.conversation_id == uuid.UUID(conversation_id)
        )
    ).one()

    if message_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conversation has no messages to process",
        )

    # Process the conversation
    try:
        # Create profile analyzer
        profile_analyzer = ProfileAnalysisService(lambda: Session(engine))

        # Run immediately for better debugging
        result = await profile_analyzer.process_conversation(
            conversation_id, str(current_user.id)
        )

        return {
            "status": "success",
            "message": f"Profile extraction completed for conversation {conversation_id}",
            "message_count": message_count,
            "insights_extracted": result.get("insights_count", 0),
        }
    except Exception as e:
        # Log the error but don't expose details to the client
        logger.error(f"Profile extraction failed: {str(e)}")
        logger.error(traceback.format_exc())

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile extraction failed. Check server logs for details.",
        )


@router.post("/generate-sample-profile")
async def generate_sample_profile(
    session: SessionDep,
    current_user: CurrentUser,
):
    """Generate a sample profile with insights for testing"""
    # Get or create profile
    profile = session.exec(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    ).first()

    if not profile:
        profile = UserProfile(
            user_id=current_user.id,
            addiction_type="alcohol",
            motivation_level=7,
            recovery_stage="contemplation",
            abstinence_days=3,
            abstinence_start_date=datetime.utcnow() - timedelta(days=3),
            last_updated=datetime.utcnow(),
        )
        session.add(profile)
        session.commit()
        session.refresh(profile)
    else:
        # Update existing profile with sample data
        profile.addiction_type = "alcohol"
        profile.motivation_level = 7
        profile.recovery_stage = "contemplation"
        profile.abstinence_days = 3
        profile.abstinence_start_date = datetime.utcnow() - timedelta(days=3)
        profile.last_updated = datetime.utcnow()
        session.add(profile)
        session.commit()

    # Create sample insights
    insights = [
        UserInsight(
            user_id=current_user.id,
            profile_id=profile.id,
            insight_type="trigger",
            value="weekend social events",
            day_of_week="saturday",
            emotional_significance=0.8,
            confidence=0.9,
            extracted_at=datetime.utcnow(),
        ),
        UserInsight(
            user_id=current_user.id,
            profile_id=profile.id,
            insight_type="trigger",
            value="work stress",
            time_of_day="evening",
            emotional_significance=0.7,
            confidence=0.8,
            extracted_at=datetime.utcnow(),
        ),
        UserInsight(
            user_id=current_user.id,
            profile_id=profile.id,
            insight_type="psychological_trait",
            value="fear_of_failure:true",
            emotional_significance=0.6,
            confidence=0.7,
            extracted_at=datetime.utcnow(),
        ),
        UserInsight(
            user_id=current_user.id,
            profile_id=profile.id,
            insight_type="psychological_trait",
            value="need_for_approval:true",
            emotional_significance=0.65,
            confidence=0.75,
            extracted_at=datetime.utcnow(),
        ),
        UserInsight(
            user_id=current_user.id,
            profile_id=profile.id,
            insight_type="coping_strategy",
            value="exercise after work",
            emotional_significance=0.5,
            confidence=0.6,
            extracted_at=datetime.utcnow(),
        ),
        UserInsight(
            user_id=current_user.id,
            profile_id=profile.id,
            insight_type="recovery_stage",
            value="contemplation",
            emotional_significance=0.9,
            confidence=0.85,
            extracted_at=datetime.utcnow(),
        ),
        UserInsight(
            user_id=current_user.id,
            profile_id=profile.id,
            insight_type="psychological_trait",
            value="fear_of_failure:true",
            emotional_significance=0.6,
            confidence=0.7,
            extracted_at=datetime.utcnow(),
        ),
        UserInsight(
            user_id=current_user.id,
            profile_id=profile.id,
            insight_type="psychological_trait",
            value="need_for_approval:true",
            emotional_significance=0.65,
            confidence=0.75,
            extracted_at=datetime.utcnow(),
        ),
        UserInsight(
            user_id=current_user.id,
            profile_id=profile.id,
            insight_type="coping_strategy",
            value="exercise after work",
            emotional_significance=0.5,
            confidence=0.6,
            extracted_at=datetime.utcnow(),
        ),
        UserInsight(
            user_id=current_user.id,
            profile_id=profile.id,
            insight_type="recovery_stage",
            value="contemplation",
            emotional_significance=0.9,
            confidence=0.85,
            extracted_at=datetime.utcnow(),
        ),
        UserInsight(
            user_id=current_user.id,
            profile_id=profile.id,
            insight_type="motivation",
            value="Motivation level: 7/10",
            emotional_significance=0.8,
            confidence=0.8,
            extracted_at=datetime.utcnow(),
        ),
        UserInsight(
            user_id=current_user.id,
            profile_id=profile.id,
            insight_type="notification_keyword",
            value="saturday:drinking",
            day_of_week="saturday",
            emotional_significance=0.7,
            confidence=0.75,
            extracted_at=datetime.utcnow(),
        ),
    ]


@router.post("/process-all-conversations")
async def process_all_conversations(
    session: SessionDep,
    current_user: CurrentUser,
):
    """Process all conversations for the current user to extract profile insights"""
    from sqlmodel import Session

    from app.core.db import engine
    from app.services.profile_extractor import process_conversation_for_profile

    # Get all conversations for the user
    conversations = session.exec(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
    ).all()

    if not conversations:
        return {
            "status": "success",
            "message": "No conversations found for processing",
            "processed_count": 0,
        }

    processed_count = 0
    errors = []

    # Process each conversation
    for conversation in conversations:
        # Check if conversation has messages
        message_count = session.exec(
            select(func.count(Message.id)).where(
                Message.conversation_id == conversation.id
            )
        ).one()

        if message_count == 0:
            continue

        try:
            # Process each conversation
            await process_conversation_for_profile(
                session_factory=lambda: Session(engine),
                conversation_id=str(conversation.id),
                user_id=str(current_user.id),
            )
            processed_count += 1

        except Exception as e:
            # Log the error but continue with other conversations
            logger.error(f"Failed to process conversation {conversation.id}: {str(e)}")
            logger.error(traceback.format_exc())
            errors.append(str(conversation.id))

    return {
        "status": "success",
        "message": f"Processed {processed_count} conversations",
        "processed_count": processed_count,
        "total_conversations": len(conversations),
        "errors": errors,
    }


@router.get("/visualization-data")
async def get_visualization_data(session: SessionDep, current_user: CurrentUser):
    """Get formatted data for profile visualizations"""

    # Get user profile
    profile = session.exec(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    ).first()

    if not profile:
        return {"profile": None, "insights": [], "connections": []}

    # Get insights
    insights = session.exec(
        select(UserInsight)
        .where(UserInsight.user_id == current_user.id)
        .order_by(UserInsight.extracted_at.desc())
    ).all()

    # Format insights for the frontend
    formatted_insights = []
    for insight in insights:
        formatted_insight = {
            "id": str(insight.id),
            "type": insight.insight_type,
            "value": insight.value,
            "significance": insight.emotional_significance,
            "confidence": insight.confidence,
            "day_of_week": insight.day_of_week,
            "time_of_day": insight.time_of_day,
            "extracted_at": insight.extracted_at.isoformat()
            if insight.extracted_at
            else None,
        }
        formatted_insights.append(formatted_insight)

    # Generate connections between insights
    connections = []

    # Connect triggers with psychological traits
    trigger_insights = [i for i in insights if i.insight_type == "trigger"]
    trait_insights = [i for i in insights if i.insight_type == "psychological_trait"]
    strategy_insights = [i for i in insights if i.insight_type == "coping_strategy"]

    # Create connections between traits and triggers
    for trait in trait_insights:
        trait_value = trait.value.lower()

        for trigger in trigger_insights:
            trigger_value = trigger.value.lower()

            # Check for relationships
            is_related = False

            # Need for approval related to social situations
            if "need_for_approval" in trait_value and any(
                word in trigger_value for word in ["social", "friend", "party"]
            ):
                is_related = True

            # Low self-confidence related to stress/anxiety
            if "low_self_confidence" in trait_value and any(
                word in trigger_value for word in ["stress", "anxi", "pressure"]
            ):
                is_related = True

            # Fear of rejection related to social situations
            if "fear_of_rejection" in trait_value and any(
                word in trigger_value for word in ["social", "family", "friend"]
            ):
                is_related = True

            if is_related:
                connections.append(
                    {
                        "source": str(trait.id),
                        "target": str(trigger.id),
                        "type": "influences",
                        "strength": 0.7,
                    }
                )

    # Connect coping strategies to triggers they help with
    for strategy in strategy_insights:
        strategy_value = strategy.value.lower()

        for trigger in trigger_insights:
            trigger_value = trigger.value.lower()

            # Check for relationships
            is_relevant = False

            # Exercise helps with stress
            if "exercise" in strategy_value and any(
                word in trigger_value for word in ["stress", "anxiety"]
            ):
                is_relevant = True

            # Meditation helps with anxiety
            if "meditation" in strategy_value and any(
                word in trigger_value for word in ["anxiety", "stress"]
            ):
                is_relevant = True

            # Social support helps with loneliness
            if any(
                word in strategy_value for word in ["call", "friend", "support"]
            ) and any(word in trigger_value for word in ["lone", "alone"]):
                is_relevant = True

            if is_relevant:
                connections.append(
                    {
                        "source": str(strategy.id),
                        "target": str(trigger.id),
                        "type": "helps_with",
                        "strength": 0.8,
                    }
                )

    return {
        "profile": {
            "id": str(profile.id),
            "addiction_type": profile.addiction_type,
            "recovery_stage": profile.recovery_stage,
            "motivation_level": profile.motivation_level,
            "abstinence_days": profile.abstinence_days,
            "abstinence_start_date": profile.abstinence_start_date.isoformat()
            if profile.abstinence_start_date
            else None,
            "last_updated": profile.last_updated.isoformat()
            if profile.last_updated
            else None,
        },
        "insights": formatted_insights,
        "connections": connections,
    }


# Add these to your profiles.py file
@router.post("/analyze-conversation")
async def analyze_conversation(
    conversation_id: str,
    user_id: str = None,
    is_goal_accepted: bool = False,
    goal_description: str = None,
    session: SessionDep = None,
    current_user: CurrentUser = None,
):
    """Analyze a conversation to extract profile insights"""
    from sqlmodel import Session

    from app.core.db import engine
    from app.services.profile_analysis_service import ProfileAnalysisService

    # Use current user ID if no specific user_id provided
    if not user_id and current_user:
        user_id = str(current_user.id)

    # Initialize the analyzer service
    analyzer = ProfileAnalysisService(lambda: Session(engine))

    # Process the conversation
    result = await analyzer.process_conversation(
        conversation_id, user_id, is_goal_accepted, goal_description
    )

    return result


@router.post("/analyze-message")
async def analyze_message(
    message: dict,
    user_id: str = None,
    session: SessionDep = None,
    current_user: CurrentUser = None,
):
    """Analyze a single message to extract profile insights"""
    from sqlmodel import Session

    from app.core.db import engine
    from app.services.profile_analysis_service import ProfileAnalysisService

    # Use current user ID if no specific user_id provided
    if not user_id and current_user:
        user_id = str(current_user.id)

    # Initialize the analyzer service
    analyzer = ProfileAnalysisService(lambda: Session(engine))

    # Analyze the message
    insights = await analyzer.analyze_message(user_id, message)

    return {"insights": insights}

# Add this to backend/app/api/routes/profiles.py

@router.put("/goals/{goal_id}/progress", response_model=dict)
def update_goal_progress(
    goal_id: uuid.UUID, 
    progress_data: dict, 
    session: SessionDep, 
    current_user: CurrentUser
):
    """Update progress on a goal"""
    goal = session.exec(
        select(UserGoal)
        .where(UserGoal.id == goal_id)
        .where(UserGoal.user_id == current_user.id)
    ).first()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )
    
    # Validate progress percentage
    progress = progress_data.get("progress")
    if progress is None or not (0 <= progress <= 100):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Progress must be a number between 0 and 100"
        )
    
    # Make sure metadata exists
    if not hasattr(goal, "metadata") or goal.metadata is None:
        goal.metadata = {}
    
    # Convert to regular dict if it's not already
    if not isinstance(goal.metadata, dict):
        goal.metadata = {}
    
    # Update progress and last_updated
    goal.metadata["progress"] = progress
    goal.metadata["last_updated"] = datetime.utcnow().isoformat()
    
    # Auto-complete goal if progress reaches 100%
    if progress == 100 and goal.status == "active":
        goal.status = "completed"
        goal.metadata["completed_at"] = datetime.utcnow().isoformat()
        
        # Create an insight about goal completion
        insight = UserInsight(
            user_id=current_user.id,
            insight_type="goal_completion",
            value=f"Completed goal: {goal.description}",
            confidence=1.0,
            extracted_at=datetime.utcnow(),
            emotional_significance=0.9
        )
        session.add(insight)
    
    session.add(goal)
    session.commit()
    
    return {
        "id": str(goal.id),
        "description": goal.description,
        "created_at": goal.created_at.isoformat(),
        "target_date": goal.target_date.isoformat() if goal.target_date else None,
        "status": goal.status,
        "progress": progress,
        "last_updated": goal.metadata.get("last_updated")
    }

# Add this to backend/app/api/routes/profiles.py

@router.post("/goals/{goal_id}/check-in", response_model=dict)
def goal_check_in(
    goal_id: uuid.UUID,
    check_in_data: dict,
    session: SessionDep,
    current_user: CurrentUser
):
    """Record a check-in for a goal with reflections"""
    goal = session.exec(
        select(UserGoal)
        .where(UserGoal.id == goal_id)
        .where(UserGoal.user_id == current_user.id)
    ).first()

    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found"
        )
    
    if goal.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot check in on a goal with status '{goal.status}'"
        )
    
    # Initialize metadata if needed
    if not hasattr(goal, "metadata") or goal.metadata is None:
        goal.metadata = {}
    
    # Convert to regular dict if it's not already
    if not isinstance(goal.metadata, dict):
        goal.metadata = {}
    
    if "check_ins" not in goal.metadata:
        goal.metadata["check_ins"] = []
    
    # Create check-in record
    check_in = {
        "date": datetime.utcnow().isoformat(),
        "reflection": check_in_data.get("reflection", ""),
        "obstacles": check_in_data.get("obstacles", ""),
        "next_steps": check_in_data.get("next_steps", ""),
        "mood": check_in_data.get("mood", 5)  # 1-10 scale
    }
    
    # Add to check-ins list
    goal.metadata["check_ins"].append(check_in)
    
    # Update goal last activity
    goal.metadata["last_check_in"] = datetime.utcnow().isoformat()
    
    # Increment check-in streak if within 48 hours of last check-in
    streak = goal.metadata.get("streak", 0)
    last_check_in = goal.metadata.get("last_check_in")
    
    if last_check_in:
        try:
            last_date = datetime.fromisoformat(last_check_in)
            hours_since = (datetime.utcnow() - last_date).total_seconds() / 3600
            
            if hours_since <= 48:  # Within 48 hours counts as maintaining streak
                goal.metadata["streak"] = streak + 1
            else:
                # Reset streak if too much time passed
                goal.metadata["streak"] = 1
        except (ValueError, TypeError):
            goal.metadata["streak"] = 1
    else:
        goal.metadata["streak"] = 1
    
    # Update progress if provided
    if "progress" in check_in_data and isinstance(check_in_data["progress"], (int, float)):
        progress = min(max(0, check_in_data["progress"]), 100)  # Ensure it's 0-100
        goal.metadata["progress"] = progress
        
        # Auto-complete goal if progress reaches 100%
        if progress == 100 and goal.status == "active":
            goal.status = "completed"
            goal.metadata["completed_at"] = datetime.utcnow().isoformat()
    
    session.add(goal)
    session.commit()
    
    return {
        "id": str(goal.id),
        "description": goal.description,
        "check_in": check_in,
        "streak": goal.metadata.get("streak", 1),
        "message": f"Check-in recorded. Your streak is now {goal.metadata.get('streak', 1)} days!"
    }

# Add this to backend/app/api/routes/profiles.py

@router.get("/goal-recommendations", response_model=list[dict])
def get_goal_recommendations(session: SessionDep, current_user: CurrentUser):
    """Generate personalized goal recommendations based on user profile"""
    # Get user profile
    profile = session.exec(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    ).first()
    
    if not profile:
        # Create a default profile if none exists
        profile = UserProfile(user_id=current_user.id)
        session.add(profile)
        session.commit()
        session.refresh(profile)
    
    # Get user insights to base recommendations on
    insights = session.exec(
        select(UserInsight)
        .where(UserInsight.user_id == current_user.id)
        .order_by(UserInsight.extracted_at.desc())
        .limit(20)
    ).all()
    
    # Create recommendations based on recovery stage
    recommendations = []
    
    # Recovery stage specific recommendations
    recovery_stage = profile.recovery_stage or "contemplation"  # Default to contemplation
    
    if recovery_stage == "precontemplation":
        recommendations.append({
            "description": "Keep a daily journal about how you feel about your habits",
            "reason": "Helps build awareness without requiring immediate change",
            "difficulty": "easy",
            "type": "awareness"
        })
        recommendations.append({
            "description": "Read one article about recovery each week",
            "reason": "Builds knowledge without pressure",
            "difficulty": "easy",
            "type": "education"
        })
        
    elif recovery_stage == "contemplation":
        recommendations.append({
            "description": "Write down three reasons why change would be beneficial",
            "reason": "Helps clarify your personal motivations",
            "difficulty": "medium",
            "type": "motivation"
        })
        recommendations.append({
            "description": "Talk to someone who has successfully made similar changes",
            "reason": "Builds confidence that change is possible",
            "difficulty": "medium",
            "type": "social"
        })
        
    elif recovery_stage == "preparation":
        recommendations.append({
            "description": "Create a list of specific situations that trigger urges",
            "reason": "Helps prepare for challenges ahead",
            "difficulty": "medium",
            "type": "planning"
        })
        recommendations.append({
            "description": "Choose one day this week to practice your planned coping strategies",
            "reason": "Tests strategies in a controlled way",
            "difficulty": "medium",
            "type": "practice"
        })
        
    elif recovery_stage == "action":
        recommendations.append({
            "description": "Avoid your top three triggers completely for one week",
            "reason": "Builds confidence in your ability to resist",
            "difficulty": "hard",
            "type": "avoidance"
        })
        recommendations.append({
            "description": "Practice your chosen relaxation technique daily",
            "reason": "Strengthens your coping skills",
            "difficulty": "medium",
            "type": "coping"
        })
        
    elif recovery_stage == "maintenance":
        recommendations.append({
            "description": "Create a relapse prevention plan",
            "reason": "Prepares you for unexpected challenges",
            "difficulty": "medium",
            "type": "prevention"
        })
        recommendations.append({
            "description": "Share your recovery story with someone who might benefit",
            "reason": "Reinforces your progress and helps others",
            "difficulty": "hard",
            "type": "advocacy"
        })
    
    # Add insight-specific recommendations
    triggers = []
    psych_traits = []
    
    for insight in insights:
        # Extract triggers
        if insight.insight_type == "trigger" and insight.value:
            triggers.append(insight.value)
            
        # Extract psychological traits
        elif insight.insight_type == "psychological_trait" and insight.value:
            trait = insight.value.split(':')[0] if ':' in insight.value else insight.value
            psych_traits.append(trait)
    
    # Add trigger-based recommendations
    for trigger in triggers[:2]:  # Limit to 2 trigger recommendations
        recommendations.append({
            "description": f"Practice a coping strategy before encountering '{trigger}'",
            "reason": f"Directly addresses your identified trigger",
            "difficulty": "medium",
            "type": "trigger_specific"
        })
    
    # Add trait-based recommendations
    trait_recommendations = {
        "need_for_approval": {
            "description": "Practice saying 'no' to a small request this week",
            "reason": "Helps reduce dependency on others' approval",
            "difficulty": "medium",
            "type": "independence"
        },
        "fear_of_rejection": {
            "description": "Share a small personal concern with someone you trust",
            "reason": "Builds confidence in being authentic with others",
            "difficulty": "medium",
            "type": "vulnerability"
        },
        "low_self_confidence": {
            "description": "Write down one personal achievement each day, no matter how small",
            "reason": "Builds self-confidence gradually",
            "difficulty": "easy",
            "type": "confidence_building"
        },
        "submissiveness": {
            "description": "Make one decision without asking for input from others",
            "reason": "Strengthens independent decision-making",
            "difficulty": "medium",
            "type": "autonomy"
        }
    }
    
    for trait in psych_traits:
        if trait in trait_recommendations:
            recommendations.append(trait_recommendations[trait])
    
    # Limit to 5 recommendations and ensure they're unique
    unique_recommendations = []
    descriptions = set()
    
    for rec in recommendations:
        if rec["description"] not in descriptions:
            descriptions.add(rec["description"])
            unique_recommendations.append(rec)
            
            if len(unique_recommendations) >= 5:
                break
    
    return unique_recommendations

# Add this to backend/app/api/routes/profiles.py

@router.get("/goal-journey", response_model=dict)
def get_goal_journey(session: SessionDep, current_user: CurrentUser):
    """Get data for visualizing the user's goal and recovery journey"""
    # Get all goals, completed and active
    goals = session.exec(
        select(UserGoal)
        .where(UserGoal.user_id == current_user.id)
        .order_by(UserGoal.created_at)
    ).all()
    
    # Get user profile
    profile = session.exec(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    ).first()
    
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        session.add(profile)
        session.commit()
        session.refresh(profile)
    
    # Get key insights
    insights = session.exec(
        select(UserInsight)
        .where(UserInsight.user_id == current_user.id)
        .where(UserInsight.insight_type.in_(["recovery_stage", "abstinence", "motivation"]))
        .order_by(UserInsight.extracted_at)
    ).all()
    
    # Format timeline events
    timeline_events = []
    
    # Add goals to timeline
    for goal in goals:
        event = {
            "type": "goal_created",
            "date": goal.created_at.isoformat(),
            "title": f"Goal Set: {goal.description[:30]}{'...' if len(goal.description) > 30 else ''}",
            "details": goal.description,
            "id": str(goal.id)
        }
        timeline_events.append(event)
        
        # Add completion events for completed goals
        if goal.status == "completed":
            # Check if we have completion metadata
            completed_at = None
            if hasattr(goal, "metadata") and isinstance(goal.metadata, dict):
                completed_at = goal.metadata.get("completed_at")
                
            # Use current time if no completion timestamp is available
            if not completed_at:
                completed_at = datetime.utcnow().isoformat()
                
            event = {
                "type": "goal_completed",
                "date": completed_at,
                "title": f"Goal Achieved: {goal.description[:30]}{'...' if len(goal.description) > 30 else ''}",
                "details": goal.description,
                "id": str(goal.id)
            }
            timeline_events.append(event)
    
    # Add abstinence milestones
    if profile and profile.abstinence_start_date:
        # Calculate milestones (1 day, 1 week, 1 month, etc.)
        start_date = profile.abstinence_start_date
        milestones = [
            (1, "First day of abstinence"),
            (7, "One week milestone"),
            (30, "One month milestone"),
            (90, "Three month milestone"),
            (180, "Six month milestone"),
            (365, "One year milestone")
        ]
        
        for days, title in milestones:
            milestone_date = start_date + timedelta(days=days)
            
            # Only include passed milestones
            if milestone_date <= datetime.utcnow():
                event = {
                    "type": "abstinence_milestone",
                    "date": milestone_date.isoformat(),
                    "title": title,
                    "details": f"Maintained abstinence for {days} days",
                }
                timeline_events.append(event)
    
    # Add recovery stage changes
    current_stage = None
    for insight in insights:
        if insight.insight_type == "recovery_stage" and insight.value != current_stage:
            current_stage = insight.value
            event = {
                "type": "stage_change",
                "date": insight.extracted_at.isoformat(),
                "title": f"Entered {insight.value.capitalize()} Stage",
                "details": f"Your recovery journey progressed to the {insight.value} stage",
            }
            timeline_events.append(event)
    
    # Sort all events by date
    timeline_events.sort(key=lambda x: x["date"])
    
    # Get active goals with their progress
    active_goals = []
    for goal in goals:
        if goal.status == "active":
            progress = 0
            streak = 0
            last_check_in = None
            
            # Extract metadata if available
            if hasattr(goal, "metadata") and isinstance(goal.metadata, dict):
                progress = goal.metadata.get("progress", 0)
                streak = goal.metadata.get("streak", 0)
                last_check_in = goal.metadata.get("last_check_in")
            
            active_goals.append({
                "id": str(goal.id),
                "description": goal.description,
                "created_at": goal.created_at.isoformat(),
                "target_date": goal.target_date.isoformat() if goal.target_date else None,
                "progress": progress,
                "streak": streak,
                "last_check_in": last_check_in,
                "days_since_creation": (datetime.utcnow() - goal.created_at).days
            })
    
    return {
        "timeline": timeline_events,
        "current_stage": profile.recovery_stage if profile else None,
        "abstinence_days": profile.abstinence_days if profile else 0,
        "total_goals": len(goals),
        "completed_goals": sum(1 for goal in goals if goal.status == "completed"),
        "active_goals": active_goals
    }


# Add these functions to your profiles.py file

@router.post("/analyze-full-conversation/{conversation_id}")
async def analyze_full_conversation(
    conversation_id: str,
    background_tasks: BackgroundTasks,
    session: SessionDep,
    current_user: CurrentUser,
):
    """Analyze a complete conversation and return structured profile insights"""
    import traceback
    from sqlmodel import Session
    from app.core.db import engine
    from app.services.profile_analysis_service import ProfileAnalysisService
    
    # Verify the conversation exists and belongs to the user
    conversation = session.exec(
        select(Conversation)
        .where(Conversation.id == uuid.UUID(conversation_id))
        .where(Conversation.user_id == current_user.id)
    ).first()

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found or doesn't belong to you",
        )
    
    # Create profile analyzer
    profile_analyzer = ProfileAnalysisService(lambda: Session(engine))
    
    # Process conversation and get structured results
    try:
        result = await profile_analyzer.process_conversation_with_structured_output(
            conversation_id, str(current_user.id)
        )
        
        # Return the already well-formatted results
        return result
        
    except Exception as e:
        logger.error(f"Profile extraction failed: {str(e)}")
        logger.error(traceback.format_exc())
        
        raise HTTPException(
            status_code=500,
            detail="Error processing conversation for profile extraction",
        )


@router.post("/real-time-profile-update")
async def real_time_profile_update(
    message_data: dict,
    session: SessionDep,
    current_user: CurrentUser,
):
    """Update profile in real-time based on a single message"""
    from sqlmodel import Session
    from app.core.db import engine
    from app.services.profile_analysis_service import ProfileAnalysisService
    
    # Validate message data
    if "content" not in message_data or "role" not in message_data:
        raise HTTPException(
            status_code=400,
            detail="Message must contain 'content' and 'role' fields",
        )
    
    # Create profile analyzer
    profile_analyzer = ProfileAnalysisService(lambda: Session(engine))
    
    # Analyze message for profile updates
    try:
        result = await profile_analyzer.analyze_message(
            str(current_user.id), message_data
        )
        
        return {
            "status": "success",
            "insights_extracted": len(result.get("insights", {})),
            "profile_updated": True,
            "current_profile": {
                "addiction_type": result["current_profile"].get("addiction_type"),
                "recovery_stage": result["current_profile"].get("recovery_stage"),
                "motivation_level": result["current_profile"].get("motivation_level"),
                "psychological_traits": result["current_profile"].get("psychological_traits"),
            }
        }
        
    except Exception as e:
        logger.error(f"Real-time profile update failed: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        
        raise HTTPException(
            status_code=500,
            detail="Error updating profile in real-time",
        )


@router.get("/structured-profile")
async def get_structured_profile(
    session: SessionDep,
    current_user: CurrentUser,
):
    """Get structured profile information with insights grouped by category"""
    # Get user profile
    profile = session.exec(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    ).first()

    if not profile:
        return {
            "profile": None,
            "insights": {},
            "summary": {
                "has_profile": False,
                "message": "No profile found. Start chatting to build your profile."
            }
        }

    # Get all insights for the user
    insights = session.exec(
        select(UserInsight)
        .where(UserInsight.user_id == current_user.id)
        .order_by(UserInsight.extracted_at.desc())
    ).all()

    # Group insights by type
    grouped_insights = {}
    for insight in insights:
        if insight.insight_type not in grouped_insights:
            grouped_insights[insight.insight_type] = []
        
        grouped_insights[insight.insight_type].append({
            "id": str(insight.id),
            "value": insight.value,
            "confidence": insight.confidence,
            "emotional_significance": insight.emotional_significance,
            "day_of_week": insight.day_of_week,
            "time_of_day": insight.time_of_day,
            "extracted_at": insight.extracted_at.isoformat() if insight.extracted_at else None,
        })

    # Get active goals
    goals = session.exec(
        select(UserGoal)
        .where(UserGoal.user_id == current_user.id)
        .where(UserGoal.status == "active")
    ).all()
    
    # Extract psychological traits
    psychological_traits = {}
    for insight in insights:
        if insight.insight_type == "psychological_trait":
            if ":" in insight.value:
                key, value = insight.value.split(":", 1)
                psychological_traits[key] = value.lower() == "true"
    
    # Format the response
    return {
        "profile": {
            "id": str(profile.id),
            "addiction_type": profile.addiction_type,
            "recovery_stage": profile.recovery_stage,
            "motivation_level": profile.motivation_level,
            "abstinence_days": profile.abstinence_days,
            "abstinence_start_date": profile.abstinence_start_date.isoformat() 
                if profile.abstinence_start_date else None,
            "psychological_traits": psychological_traits or profile.psychological_traits,
            "last_updated": profile.last_updated.isoformat() 
                if profile.last_updated else None,
        },
        "insights": grouped_insights,
        "goals": [
            {
                "id": str(goal.id),
                "description": goal.description,
                "created_at": goal.created_at.isoformat(),
                "target_date": goal.target_date.isoformat() if goal.target_date else None,
                "status": goal.status,
            }
            for goal in goals
        ],
        "summary": {
            "has_profile": True,
            "insight_count": len(insights),
            "insight_types": list(grouped_insights.keys()),
            "goals_count": len(goals),
            "last_updated": profile.last_updated.isoformat() 
                if profile.last_updated else None,
        }
    }