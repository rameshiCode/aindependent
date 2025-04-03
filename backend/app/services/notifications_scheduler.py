import logging
from datetime import datetime, timedelta

from sqlmodel import Session, select

from app.models import ScheduledNotification, UserGoal, UserInsight, UserProfile

logger = logging.getLogger(__name__)


class NotificationScheduler:
    def __init__(self, session: Session):
        self.session = session
        self.MAX_WEEKLY_NOTIFICATIONS = 3

    async def schedule_notifications_for_user(self, user_id: str):
        """Schedule notifications for a user based on their profile"""
        # Get user profile
        profile = self.session.exec(
            select(UserProfile).where(UserProfile.user_id == user_id)
        ).first()

        if not profile:
            logger.warning(f"No profile found for user {user_id}")
            return

        # Get notification count for the current week
        start_of_week = datetime.utcnow() - timedelta(days=datetime.utcnow().weekday())
        current_notifications = self.session.exec(
            select(ScheduledNotification)
            .where(ScheduledNotification.user_id == user_id)
            .where(ScheduledNotification.scheduled_for >= start_of_week)
            .where(ScheduledNotification.sent == False)
        ).all()

        notification_count = len(current_notifications)
        if notification_count >= self.MAX_WEEKLY_NOTIFICATIONS:
            logger.info(
                f"User {user_id} already has {notification_count} notifications scheduled this week"
            )
            return

        remaining_notifications = self.MAX_WEEKLY_NOTIFICATIONS - notification_count

        # Get relevant insights
        insights = self.session.exec(
            select(UserInsight)
            .where(UserInsight.user_id == user_id)
            .order_by(UserInsight.extracted_at.desc())
            .limit(20)
        ).all()

        # Get active goals
        goals = self.session.exec(
            select(UserGoal)
            .where(UserGoal.user_id == user_id)
            .where(UserGoal.status == "active")
        ).all()

        # Prioritize what to notify about
        notifications_to_schedule = []

        # 1. Check for upcoming goal deadlines
        for goal in goals:
            if goal.target_date and goal.target_date > datetime.utcnow():
                days_until_target = (goal.target_date - datetime.utcnow()).days

                # If goal is approaching (within 2 days)
                if 0 <= days_until_target <= 2:
                    notifications_to_schedule.append(
                        {
                            "type": "goal_reminder",
                            "title": "Goal Reminder",
                            "body": f"Your goal '{goal.description}' is due soon!",
                            "scheduled_for": goal.target_date - timedelta(days=1),
                            "related_entity_id": str(goal.id),
                            "priority": 5,  # High priority
                        }
                    )

        # 2. Check for high-risk times based on schedule insights
        schedule_insights = [i for i in insights if i.insight_type == "schedule"]
        for insight in schedule_insights:
            if insight.day_of_week and insight.time_of_day:
                # Convert day of week to numeric (0 = Monday, 6 = Sunday)
                day_map = {
                    "monday": 0,
                    "tuesday": 1,
                    "wednesday": 2,
                    "thursday": 3,
                    "friday": 4,
                    "saturday": 5,
                    "sunday": 6,
                }
                day_num = day_map.get(insight.day_of_week.lower())

                if day_num is not None:
                    # Calculate next occurrence of this day
                    today = datetime.utcnow().weekday()
                    days_until = (day_num - today) % 7

                    next_occurrence = datetime.utcnow() + timedelta(days=days_until)

                    # Approximate time of day
                    time_map = {
                        "morning": 9,
                        "afternoon": 14,
                        "evening": 19,
                        "night": 21,
                    }
                    hour = time_map.get(insight.time_of_day.lower(), 12)

                    notification_time = next_occurrence.replace(
                        hour=hour, minute=0, second=0, microsecond=0
                    )

                    # Only schedule if it's in the future
                    if notification_time > datetime.utcnow():
                        notifications_to_schedule.append(
                            {
                                "type": "risk_event_reminder",
                                "title": "High-Risk Time Approaching",
                                "body": f"You've identified {insight.day_of_week} {insight.time_of_day} as a challenging time. Remember your coping strategies!",
                                "scheduled_for": notification_time
                                - timedelta(hours=1),  # 1 hour before
                                "related_entity_id": str(insight.id),
                                "priority": 4,  # Medium-high priority
                            }
                        )

        # 3. Add abstinence milestone notifications if relevant
        if (
            profile.abstinence_days > 0 and profile.abstinence_days % 7 == 0
        ):  # Weekly milestones
            # Schedule for tomorrow morning
            tomorrow = datetime.utcnow() + timedelta(days=1)
            notification_time = tomorrow.replace(
                hour=9, minute=0, second=0, microsecond=0
            )

            notifications_to_schedule.append(
                {
                    "type": "abstinence_milestone",
                    "title": "Abstinence Milestone!",
                    "body": f"Congratulations! You've maintained {profile.abstinence_days} days of abstinence. Keep going!",
                    "scheduled_for": notification_time,
                    "related_entity_id": str(profile.id),
                    "priority": 3,  # Medium priority
                }
            )

        # Sort by priority and limit to remaining notification slots
        notifications_to_schedule.sort(key=lambda x: x["priority"], reverse=True)
        notifications_to_schedule = notifications_to_schedule[:remaining_notifications]

        # Save notifications to database
        for notif in notifications_to_schedule:
            scheduled_notification = ScheduledNotification(
                user_id=user_id,
                notification_type=notif["type"],
                title=notif["title"],
                body=notif["body"],
                scheduled_for=notif["scheduled_for"],
                related_entity_id=notif["related_entity_id"],
                priority=notif["priority"],
                sent=False,
            )
            self.session.add(scheduled_notification)

        if notifications_to_schedule:
            self.session.commit()
            logger.info(
                f"Scheduled {len(notifications_to_schedule)} notifications for user {user_id}"
            )
