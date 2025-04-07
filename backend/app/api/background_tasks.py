# backend/app/api/background_tasks.py
import logging
from datetime import datetime, timedelta

from sqlmodel import select

from app.core.db import get_session
from app.models import (
    Conversation,
    ScheduledNotification,
    UserGoal,
    UserInsight,
    UserProfile,
)
from app.services.notification_content import send_personalized_notification
from app.services.notifications_scheduler import IntelligentNotificationScheduler
from app.services.profile_extractor import process_conversation_for_profile

logger = logging.getLogger(__name__)


async def process_conversation_background(conversation_id: str, user_id: str):
    """
    Process a conversation in the background to extract insights and schedule notifications.

    Args:
        conversation_id: The ID of the conversation to process
        user_id: The ID of the user who owns the conversation
    """
    logger.info(f"Starting background processing for conversation {conversation_id}")

    try:
        # Extract insights from the conversation
        await process_conversation_for_profile(
            session_factory=get_session,
            conversation_id=conversation_id,
            user_id=user_id,
        )

        # Schedule notifications based on updated profile
        session = next(get_session())
        scheduler = IntelligentNotificationScheduler(session)
        await scheduler.schedule_notifications_for_user(user_id)

        logger.info(
            f"Completed background processing for conversation {conversation_id}"
        )

    except Exception as e:
        logger.error(
            f"Error in background processing for conversation {conversation_id}: {str(e)}"
        )
        logger.exception("Background task exception:")


async def check_for_at_risk_periods(user_id: str):
    """
    Check if the user is approaching an at-risk period based on their insights
    and schedule notifications if needed.

    Args:
        user_id: The ID of the user to check
    """
    logger.info(f"Checking at-risk periods for user {user_id}")

    try:
        session = next(get_session())

        # Get user profile
        profile = session.exec(
            select(UserProfile).where(UserProfile.user_id == user_id)
        ).first()

        if not profile:
            logger.warning(f"No profile found for user {user_id}")
            return

        # Get insights related to high-risk periods
        insights = session.exec(
            select(UserInsight)
            .where(UserInsight.user_id == user_id)
            .where(UserInsight.insight_type.like("trigger_temporal%"))
            .order_by(UserInsight.emotional_significance.desc())
        ).all()

        if not insights:
            logger.info(f"No temporal trigger insights found for user {user_id}")
            return

        current_time = datetime.utcnow()
        current_day = current_time.strftime("%A").lower()

        # Check if any insights match the current day or next day
        for insight in insights:
            if not insight.day_of_week or not insight.time_of_day:
                continue

            insight_day = insight.day_of_week.lower()
            insight_time = insight.time_of_day.lower()

            # Map time of day to hours
            time_map = {"morning": 9, "afternoon": 14, "evening": 19, "night": 21}

            # If this is for today
            if insight_day == current_day:
                hour = time_map.get(insight_time, 12)
                risk_time = current_time.replace(
                    hour=hour, minute=0, second=0, microsecond=0
                )

                # If the risk time is approaching (within next 3 hours)
                time_until_risk = (risk_time - current_time).total_seconds() / 3600
                if 0 < time_until_risk <= 3:
                    # Schedule a notification
                    notification = ScheduledNotification(
                        user_id=user_id,
                        notification_type="high_risk_period",
                        title="Preparing for Challenge",
                        body=f"You've mentioned {insight_time} can be challenging. Open the app for support.",
                        scheduled_for=current_time + timedelta(minutes=15),  # Send soon
                        related_entity_id=str(insight.id),
                        priority=7,  # High priority
                        sent=False,
                        data={
                            "high_risk_period": f"{insight_day} {insight_time}",
                            "insight_value": insight.value,
                        },
                    )

                    session.add(notification)
                    session.commit()

                    logger.info(
                        f"Scheduled high-risk period notification for user {user_id}"
                    )
                    return

    except Exception as e:
        logger.error(f"Error checking at-risk periods for user {user_id}: {str(e)}")
        logger.exception("At-risk check exception:")


async def check_goal_deadlines(user_id: str):
    """
    Check if user has any upcoming goal deadlines and schedule
    reminder notifications.

    Args:
        user_id: The ID of the user to check
    """
    logger.info(f"Checking goal deadlines for user {user_id}")

    try:
        session = next(get_session())

        # Get active goals
        goals = session.exec(
            select(UserGoal)
            .where(UserGoal.user_id == user_id)
            .where(UserGoal.status == "active")
        ).all()

        if not goals:
            logger.info(f"No active goals found for user {user_id}")
            return

        current_date = datetime.utcnow().date()

        for goal in goals:
            if not goal.target_date:
                continue

            days_until_target = (goal.target_date.date() - current_date).days

            # Check if goal is approaching its deadline (within 1-2 days)
            if 0 <= days_until_target <= 2:
                # Check if we already have a notification for this goal
                existing_notification = session.exec(
                    select(ScheduledNotification)
                    .where(ScheduledNotification.user_id == user_id)
                    .where(ScheduledNotification.related_entity_id == str(goal.id))
                    .where(ScheduledNotification.scheduled_for >= datetime.utcnow())
                ).first()

                if existing_notification:
                    continue  # Skip if notification already exists

                # Schedule a notification
                notification = ScheduledNotification(
                    user_id=user_id,
                    notification_type="goal_deadline",
                    title="Goal Deadline Approaching",
                    body=f"Your goal '{goal.description}' is due soon. Open to track your progress.",
                    scheduled_for=datetime.utcnow()
                    + timedelta(hours=1),  # Send in the next hour
                    related_entity_id=str(goal.id),
                    priority=6,  # High priority but not as high as risk
                    sent=False,
                    data={
                        "days_until_deadline": days_until_target,
                        "goal_description": goal.description,
                    },
                )

                session.add(notification)
                session.commit()

                logger.info(
                    f"Scheduled goal deadline notification for user {user_id}, goal {goal.id}"
                )

    except Exception as e:
        logger.error(f"Error checking goal deadlines for user {user_id}: {str(e)}")
        logger.exception("Goal check exception:")


async def send_pending_notifications():
    """
    Background task to process and send all pending notifications
    """
    logger.info("Starting to process pending notifications")

    try:
        session = next(get_session())

        # Find notifications that are due but not sent
        current_time = datetime.utcnow()

        pending_notifications = session.exec(
            select(ScheduledNotification)
            .where(ScheduledNotification.scheduled_for <= current_time)
            .where(ScheduledNotification.sent == False)
        ).all()

        logger.info(f"Found {len(pending_notifications)} pending notifications to send")

        # Process each notification
        for notification in pending_notifications:
            try:
                # Send personalized notification
                await send_personalized_notification(
                    session=session,
                    user_id=notification.user_id,
                    notification_id=str(notification.id),
                )

            except Exception as e:
                logger.error(f"Error sending notification {notification.id}: {str(e)}")

    except Exception as e:
        logger.error(f"Error processing pending notifications: {str(e)}")
        logger.exception("Notification processing exception:")


# This will be scheduled to run periodically in the main FastAPI app
async def run_periodic_tasks():
    """
    Run all periodic background tasks
    """
    try:
        # Process pending notifications
        await send_pending_notifications()

        # Check for users with recent activity
        session = next(get_session())
        recent_time = datetime.utcnow() - timedelta(days=1)

        active_users = session.exec(
            select(Conversation.user_id)
            .where(Conversation.updated_at >= recent_time)
            .distinct()
        ).all()

        # For each active user, run user-specific checks
        for user_id in active_users:
            await check_for_at_risk_periods(user_id)
            await check_goal_deadlines(user_id)

    except Exception as e:
        logger.error(f"Error running periodic tasks: {str(e)}")
        logger.exception("Periodic tasks exception:")
