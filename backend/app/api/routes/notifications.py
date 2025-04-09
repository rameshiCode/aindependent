"""
Path: /app/api/routes/notifications.py
This file implements API routes for managing user notifications based on profile insights.
"""

import logging
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from sqlmodel import select

from app.api.deps import CurrentUser, SessionDep
from app.models import UserNotification

router = APIRouter(prefix="/notifications", tags=["notifications"])
logger = logging.getLogger(__name__)


@router.get("/", response_model=list[dict])
def get_user_notifications(
    session: SessionDep,
    current_user: CurrentUser,
    limit: int = 10,
    include_sent: bool = False,
):
    """Get notifications for the current user"""
    query = select(UserNotification).where(UserNotification.user_id == current_user.id)

    if not include_sent:
        query = query.where(UserNotification.was_sent == False)

    query = query.order_by(UserNotification.scheduled_for.desc()).limit(limit)
    notifications = session.exec(query).all()

    return [
        {
            "id": str(notification.id),
            "title": notification.title,
            "body": notification.body,
            "notification_type": notification.notification_type,
            "scheduled_for": notification.scheduled_for.isoformat(),
            "priority": notification.priority,
            "was_sent": notification.was_sent,
            "was_opened": notification.was_opened,
        }
        for notification in notifications
    ]


@router.post("/mark-opened/{notification_id}")
def mark_notification_opened(
    notification_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
):
    """Mark a notification as opened"""
    notification = session.exec(
        select(UserNotification)
        .where(UserNotification.id == notification_id)
        .where(UserNotification.user_id == current_user.id)
    ).first()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    notification.was_opened = True
    session.add(notification)
    session.commit()

    return {"success": True}


@router.post("/generate", response_model=dict)
def generate_notifications(
    background_tasks: BackgroundTasks,
    session: SessionDep,
    current_user: CurrentUser,
):
    """Generate notifications based on user insights"""
    background_tasks.add_task(
        _generate_notifications_task,
        user_id=str(current_user.id),
    )

    return {"success": True, "message": "Notification generation started"}


async def _generate_notifications_task(user_id: str):
    """Background task to generate notifications based on user insights"""

    from sqlmodel import Session, select

    from app.core.db import engine
    from app.models import UserInsight, UserNotification, UserProfile

    try:
        session = Session(engine)

        # Get user profile
        profile = session.exec(
            select(UserProfile).where(UserProfile.user_id == uuid.UUID(user_id))
        ).first()

        if not profile:
            logger.warning(f"No profile found for user {user_id}")
            return

        # Get recent insights
        recent_insights = session.exec(
            select(UserInsight)
            .where(UserInsight.user_id == uuid.UUID(user_id))
            .where(UserInsight.extracted_at > datetime.utcnow() - timedelta(days=7))
            .order_by(UserInsight.extracted_at.desc())
        ).all()

        if not recent_insights:
            logger.info(f"No recent insights found for user {user_id}")
            return

        # Process notification keywords
        keyword_insights = [
            insight
            for insight in recent_insights
            if insight.insight_type == "notification_keyword"
        ]

        notifications = []

        # Create notifications based on day-specific activities
        for insight in keyword_insights:
            if ":" not in insight.value:
                continue

            day, activity = insight.value.split(":", 1)

            if day in [
                "monday",
                "tuesday",
                "wednesday",
                "thursday",
                "friday",
                "saturday",
                "sunday",
            ]:
                # Calculate next occurrence of this day
                today = datetime.utcnow().strftime("%A").lower()
                days_until = (
                    [
                        "monday",
                        "tuesday",
                        "wednesday",
                        "thursday",
                        "friday",
                        "saturday",
                        "sunday",
                    ].index(day)
                    - [
                        "monday",
                        "tuesday",
                        "wednesday",
                        "thursday",
                        "friday",
                        "saturday",
                        "sunday",
                    ].index(today)
                ) % 7

                if days_until == 0:
                    # If it's the same day, schedule for next week
                    days_until = 7

                notification_date = datetime.utcnow() + timedelta(days=days_until)

                # Check if we already have a similar notification scheduled
                existing = session.exec(
                    select(UserNotification)
                    .where(UserNotification.user_id == uuid.UUID(user_id))
                    .where(UserNotification.notification_type == "risk_event")
                    .where(UserNotification.scheduled_for > datetime.utcnow())
                    .where(UserNotification.body.contains(activity))
                ).first()

                if not existing:
                    notifications.append(
                        UserNotification(
                            user_id=uuid.UUID(user_id),
                            title="Upcoming Risk Event",
                            body=f"We noticed you might be planning to {activity} on {day.capitalize()}. Remember your goals and strategies.",
                            notification_type="risk_event",
                            scheduled_for=notification_date.replace(
                                hour=9, minute=0, second=0, microsecond=0
                            ),
                            priority=4,
                            related_entity_id=insight.id,
                        )
                    )

        # Create notifications based on abstinence milestones
        if profile.abstinence_start_date:
            days_sober = (datetime.utcnow() - profile.abstinence_start_date).days

            # Check for upcoming milestones
            upcoming_milestones = [7, 14, 30, 60, 90, 180, 365]
            for milestone in upcoming_milestones:
                days_until_milestone = milestone - days_sober

                if 0 < days_until_milestone <= 3:
                    # Milestone is approaching
                    notification_date = datetime.utcnow() + timedelta(
                        days=days_until_milestone
                    )

                    # Check if we already have a similar notification scheduled
                    existing = session.exec(
                        select(UserNotification)
                        .where(UserNotification.user_id == uuid.UUID(user_id))
                        .where(
                            UserNotification.notification_type == "abstinence_milestone"
                        )
                        .where(UserNotification.body.contains(str(milestone)))
                    ).first()

                    if not existing:
                        notifications.append(
                            UserNotification(
                                user_id=uuid.UUID(user_id),
                                title="Upcoming Milestone",
                                body=f"You're almost at {milestone} days of abstinence! Keep going, you're doing great!",
                                notification_type="abstinence_milestone",
                                scheduled_for=notification_date.replace(
                                    hour=10, minute=0, second=0, microsecond=0
                                ),
                                priority=3,
                            )
                        )

        # Save notifications
        for notification in notifications:
            session.add(notification)

        session.commit()
        logger.info(f"Generated {len(notifications)} notifications for user {user_id}")

    except Exception as e:
        logger.error(f"Error generating notifications: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
    finally:
        session.close()
