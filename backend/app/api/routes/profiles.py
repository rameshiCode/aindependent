# app/api/routes/profiles.py
import traceback
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, HTTPException, logger, status
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import Conversation, Message, UserGoal, UserInsight, UserProfile

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
    from app.services.profile_extractor import process_conversation_for_profile
    from app.core.db import engine
    from sqlmodel import Session
    
    # Verify the conversation exists and belongs to the user
    conversation = session.exec(
        select(Conversation)
        .where(Conversation.id == uuid.UUID(conversation_id))
        .where(Conversation.user_id == current_user.id)
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found or doesn't belong to you"
        )
        
    # Count the messages in the conversation
    message_count = session.exec(
        select(func.count(Message.id))
        .where(Message.conversation_id == uuid.UUID(conversation_id))
    ).one()
    
    if message_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conversation has no messages to process"
        )
        
    # Process the conversation
    try:
        # Run immediately for better debugging
        await process_conversation_for_profile(
            session_factory=lambda: Session(engine),
            conversation_id=conversation_id,
            user_id=str(current_user.id),
        )
        
        return {
            "status": "success",
            "message": f"Profile extraction completed for conversation {conversation_id}",
            "message_count": message_count
        }
    except Exception as e:
        # Log the error but don't expose details to the client
        logger.error(f"Profile extraction failed: {str(e)}")
        logger.error(traceback.format_exc())
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile extraction failed. Check server logs for details."
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
            last_updated=datetime.utcnow()
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
        )
    ]

@router.post("/process-all-conversations")
async def process_all_conversations(
    session: SessionDep,
    current_user: CurrentUser,
):
    """Process all conversations for the current user to extract profile insights"""
    from app.services.profile_extractor import process_conversation_for_profile
    from app.core.db import engine
    from sqlmodel import Session
    
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
            "processed_count": 0
        }
        
    processed_count = 0
    errors = []
    
    # Process each conversation
    for conversation in conversations:
        # Check if conversation has messages
        message_count = session.exec(
            select(func.count(Message.id))
            .where(Message.conversation_id == conversation.id)
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
        "errors": errors
    }