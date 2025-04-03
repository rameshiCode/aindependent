# app/api/routes/profiles.py
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from app.api.deps import CurrentUser, SessionDep
from app.models import UserGoal, UserInsight, UserProfile

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
