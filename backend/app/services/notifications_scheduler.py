import logging
from datetime import datetime, timedelta, time
import json
from typing import List, Dict, Any, Optional, Tuple
from sqlmodel import Session, select, update

from app.models import (
    UserProfile, UserInsight, UserGoal, 
    ScheduledNotification, UserNotification,
    UserNotificationEngagement
)

logger = logging.getLogger(__name__)

class IntelligentNotificationScheduler:
    """Advanced notification scheduler with machine learning components"""
    
    def __init__(self, session: Session):
        self.session = session
        self.MAX_DAILY_NOTIFICATIONS = 3
        self.MAX_WEEKLY_NOTIFICATIONS = 12
        
        # Default notification windows (will be personalized per user)
        self.notification_windows = {
            "morning": {"start": time(7, 0), "end": time(10, 0)},
            "midday": {"start": time(12, 0), "end": time(14, 0)},
            "evening": {"start": time(17, 0), "end": time(20, 0)},
        }
        
        # Notification type priorities (higher is more important)
        self.notification_priorities = {
            "relapse_risk_critical": 10,  # Highest priority - imminent risk detected
            "relapse_risk_high": 9,
            "abstinence_milestone": 8,    # Celebration moments are important
            "high_risk_period": 7,        # Known difficult times
            "goal_deadline": 6,           # Approaching deadlines
            "motivation_boost": 5,        # When motivation is low
            "coping_strategy": 4,         # Suggestions based on current challenges
            "check_in": 3,                # Regular check-ins
            "insight_reinforcement": 2,   # Reinforcing learned insights
            "educational": 1              # Educational content
        }
    
    async def schedule_notifications_for_user(self, user_id: str):
        """Schedule intelligent notifications for a user based on their profile and engagement patterns"""
        # Get user profile
        profile = self.session.exec(
            select(UserProfile).where(UserProfile.user_id == user_id)
        ).first()

        if not profile:
            logger.warning(f"No profile found for user {user_id}")
            return
            
        # Get user's notification engagement patterns
        engagement_patterns = self._get_user_engagement_patterns(user_id)
        
        # Get current notification count for today and this week
        today_notifications, weekly_notifications = self._get_current_notification_counts(user_id)
        
        # Check if we've reached daily or weekly limits
        if today_notifications >= self.MAX_DAILY_NOTIFICATIONS:
            logger.info(f"User {user_id} already has {today_notifications} notifications scheduled today")
            return
            
        if weekly_notifications >= self.MAX_WEEKLY_NOTIFICATIONS:
            logger.info(f"User {user_id} already has {weekly_notifications} notifications scheduled this week")
            return
        
        # Calculate how many more notifications we can send
        remaining_daily = self.MAX_DAILY_NOTIFICATIONS - today_notifications
        
        # Get relevant data for notification decisions
        insights = self._get_user_insights(user_id)
        goals = self._get_user_goals(user_id)
        high_risk_periods = self._extract_high_risk_periods(insights)
        
        # Generate notification candidates based on user profile
        notification_candidates = []
        notification_candidates.extend(self._generate_risk_notifications(profile, insights, high_risk_periods))
        notification_candidates.extend(self._generate_goal_notifications(goals))
        notification_candidates.extend(self._generate_milestone_notifications(profile))
        notification_candidates.extend(self._generate_support_notifications(profile, insights))
        
        # Sort candidates by priority
        notification_candidates.sort(key=lambda x: x["priority"], reverse=True)
        
        # Select top candidates based on remaining capacity
        selected_notifications = notification_candidates[:remaining_daily]
        
        # Schedule notifications at optimal times
        scheduled_notifications = self._schedule_at_optimal_times(
            user_id, 
            selected_notifications, 
            engagement_patterns
        )
        
        # Save to database
        for notification in scheduled_notifications:
            scheduled_notif = ScheduledNotification(
                user_id=user_id,
                notification_type=notification["type"],
                title=notification["title"],
                body=notification["body"],
                scheduled_for=notification["scheduled_time"],
                related_entity_id=notification.get("related_entity_id"),
                priority=notification["priority"],
                sent=False,
                metadata=json.dumps(notification.get("metadata", {}))
            )
            self.session.add(scheduled_notif)
        
        if scheduled_notifications:
            self.session.commit()
            logger.info(
                f"Scheduled {len(scheduled_notifications)} intelligent notifications for user {user_id}"
            )
    
    def _get_user_engagement_patterns(self, user_id: str) -> Dict[str, Any]:
        """Analyze user's historical engagement with notifications to find optimal times"""
        # Get user's notification engagement history
        engagements = self.session.exec(
            select(UserNotificationEngagement)
            .where(UserNotificationEngagement.user_id == user_id)
            .order_by(UserNotificationEngagement.engagement_time.desc())
            .limit(50)  # Get recent engagement data
        ).all()
        
        if not engagements:
            logger.info(f"No engagement history for user {user_id}, using default patterns")
            return {
                "optimal_hours": [8, 12, 18],  # Default optimal hours
                "optimal_days": [0, 1, 2, 3, 4, 5, 6],  # All days of week
                "response_rate": 0.5  # Default expected response rate
            }
        
        # Analyze engagement times
        engagement_hours = [e.engagement_time.hour for e in engagements if e.engaged]
        engagement_days = [e.engagement_time.weekday() for e in engagements if e.engaged]
        
        # Calculate response rate
        response_rate = sum(1 for e in engagements if e.engaged) / len(engagements)
        
        # Find optimal hours (hours with the most engagements)
        hour_counts = {}
        for hour in engagement_hours:
            hour_counts[hour] = hour_counts.get(hour, 0) + 1
        
        optimal_hours = sorted(hour_counts.keys(), key=lambda h: hour_counts[h], reverse=True)[:3]
        
        # Find optimal days
        day_counts = {}
        for day in engagement_days:
            day_counts[day] = day_counts.get(day, 0) + 1
        
        optimal_days = sorted(day_counts.keys(), key=lambda d: day_counts[d], reverse=True)
        
        return {
            "optimal_hours": optimal_hours if optimal_hours else [8, 12, 18],
            "optimal_days": optimal_days if optimal_days else [0, 1, 2, 3, 4, 5, 6],
            "response_rate": response_rate
        }
    
    def _get_current_notification_counts(self, user_id: str) -> Tuple[int, int]:
        """Get the count of notifications scheduled for today and this week"""
        today = datetime.utcnow().date()
        start_of_week = today - timedelta(days=today.weekday())
        end_of_week = start_of_week + timedelta(days=6)
        
        # Today's notifications
        today_notifications = self.session.exec(
            select(ScheduledNotification)
            .where(ScheduledNotification.user_id == user_id)
            .where(ScheduledNotification.scheduled_for >= datetime.combine(today, time.min))
            .where(ScheduledNotification.scheduled_for <= datetime.combine(today, time.max))
        ).all()
        
        # This week's notifications
        weekly_notifications = self.session.exec(
            select(ScheduledNotification)
            .where(ScheduledNotification.user_id == user_id)
            .where(ScheduledNotification.scheduled_for >= datetime.combine(start_of_week, time.min))
            .where(ScheduledNotification.scheduled_for <= datetime.combine(end_of_week, time.max))
        ).all()
        
        return len(today_notifications), len(weekly_notifications)
    
    def _get_user_insights(self, user_id: str) -> List[UserInsight]:
        """Get relevant user insights for notification decisions"""
        return self.session.exec(
            select(UserInsight)
            .where(UserInsight.user_id == user_id)
            .order_by(UserInsight.emotional_significance.desc())
            .limit(30)  # Get most significant insights
        ).all()
    
    def _get_user_goals(self, user_id: str) -> List[UserGoal]:
        """Get user's active goals"""
        return self.session.exec(
            select(UserGoal)
            .where(UserGoal.user_id == user_id)
            .where(UserGoal.status == "active")
        ).all()
    
    def _extract_high_risk_periods(self, insights: List[UserInsight]) -> List[Dict[str, Any]]:
        """Extract high-risk periods from user insights"""
        high_risk_periods = []
        
        for insight in insights:
            # Look for temporal trigger insights
            if insight.insight_type == "trigger_temporal" and insight.day_of_week and insight.time_of_day:
                high_risk_periods.append({
                    "day_of_week": insight.day_of_week.lower(),
                    "time_of_day": insight.time_of_day.lower(),
                    "value": insight.value,
                    "significance": insight.emotional_significance
                })
                
        return high_risk_periods
    
    def _generate_risk_notifications(
        self, 
        profile: UserProfile, 
        insights: List[UserInsight],
        high_risk_periods: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generate risk-related notifications"""
        notifications = []
        
        # Check relapse risk score
        if profile.relapse_risk_score is not None:
            if profile.relapse_risk_score >= 80:
                notifications.append({
                    "type": "relapse_risk_critical",
                    "title": "Check-in: High Risk Period",
                    "body": "Our analysis shows you may be going through a difficult time. Open the app to connect with your AI therapist now.",
                    "priority": self.notification_priorities["relapse_risk_critical"],
                    "related_entity_id": str(profile.id),
                    "metadata": {"risk_score": profile.relapse_risk_score}
                })
            elif profile.relapse_risk_score >= 60:
                notifications.append({
                    "type": "relapse_risk_high",
                    "title": "Remember Your Strength",
                    "body": "This might be a challenging period. Review your coping strategies and remember why you started.",
                    "priority": self.notification_priorities["relapse_risk_high"],
                    "related_entity_id": str(profile.id),
                    "metadata": {"risk_score": profile.relapse_risk_score}
                })
        
        # Check for upcoming high-risk periods
        today = datetime.utcnow()
        today_day = today.strftime("%A").lower()
        
        day_map = {
            "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
            "friday": 4, "saturday": 5, "sunday": 6
        }
        
        for period in high_risk_periods:
            # Check if this risk period is for today or tomorrow
            if period["day_of_week"] == today_day:
                time_map = {
                    "morning": 9, "afternoon": 14, 
                    "evening": 19, "night": 21
                }
                
                hour = time_map.get(period["time_of_day"], 12)
                period_time = today.replace(hour=hour, minute=0, second=0, microsecond=0)
                
                # Only notify if the period is still in the future
                if period_time > today:
                    notifications.append({
                        "type": "high_risk_period",
                        "title": "Preparing for Challenge",
                        "body": f"You've identified {period['time_of_day']} as a challenging time. Open the app for personalized coping strategies.",
                        "priority": self.notification_priorities["high_risk_period"],
                        "related_entity_id": None,
                        "metadata": {"high_risk_period": f"{period['day_of_week']} {period['time_of_day']}"}
                    })
        
        return notifications
    
    def _generate_goal_notifications(self, goals: List[UserGoal]) -> List[Dict[str, Any]]:
        """Generate goal-related notifications"""
        notifications = []
        today = datetime.utcnow().date()
        
        for goal in goals:
            if goal.target_date:
                days_until_target = (goal.target_date.date() - today).days
                
                # For goals due soon
                if 0 <= days_until_target <= 2:
                    notifications.append({
                        "type": "goal_deadline",
                        "title": "Goal Deadline Approaching",
                        "body": f"Your goal '{goal.description}' is due in {days_until_target+1} days. Open to track your progress.",
                        "priority": self.notification_priorities["goal_deadline"],
                        "related_entity_id": str(goal.id),
                        "metadata": {"days_until_deadline": days_until_target+1}
                    })
        
        return notifications
    
    def _generate_milestone_notifications(self, profile: UserProfile) -> List[Dict[str, Any]]:
        """Generate milestone celebration notifications"""
        notifications = []
        
        # Abstinence milestones
        if profile.abstinence_days > 0:
            milestone_days = [1, 3, 7, 14, 30, 60, 90, 180, 365]
            next_milestone = None
            
            for milestone in milestone_days:
                if profile.abstinence_days == milestone:
                    # Exact milestone day
                    notifications.append({
                        "type": "abstinence_milestone",
                        "title": f"{milestone} Day Milestone! 🎉",
                        "body": f"Congratulations on {milestone} days of progress! This is a significant achievement in your journey.",
                        "priority": self.notification_priorities["abstinence_milestone"],
                        "related_entity_id": str(profile.id),
                        "metadata": {"milestone_days": milestone}
                    })
                elif profile.abstinence_days < milestone:
                    next_milestone = milestone
                    break
            
            # Approaching milestone (if within 2 days)
            if next_milestone and (next_milestone - profile.abstinence_days) <= 2:
                days_to_go = next_milestone - profile.abstinence_days
                notifications.append({
                    "type": "milestone_approaching",
                    "title": f"Milestone Approaching",
                    "body": f"You're just {days_to_go} days away from your {next_milestone}-day milestone! Keep going!",
                    "priority": self.notification_priorities["abstinence_milestone"] - 1,
                    "related_entity_id": str(profile.id),
                    "metadata": {"approaching_milestone": next_milestone, "days_to_go": days_to_go}
                })
        
        return notifications
    
    def _generate_support_notifications(
        self, 
        profile: UserProfile, 
        insights: List[UserInsight]
    ) -> List[Dict[str, Any]]:
        """Generate supportive notifications based on user profile and insights"""
        notifications = []
        
        # Low motivation notification
        if profile.motivation_level is not None and profile.motivation_level < 5:
            # Find a motivation insight if available
            motivation_insights = [i for i in insights if i.insight_type.startswith("motivation_")]
            
            message = "Remember why you started this journey. Each step matters."
            if motivation_insights:
                # Use the most significant motivation insight
                top_motivation = max(motivation_insights, key=lambda x: x.emotional_significance)
                message = f"Remember: {top_motivation.value}"
            
            notifications.append({
                "type": "motivation_boost",
                "title": "Motivation Reminder",
                "body": message,
                "priority": self.notification_priorities["motivation_boost"],
                "related_entity_id": str(profile.id),
                "metadata": {"motivation_level": profile.motivation_level}
            })
        
        # Coping strategy reminder
        coping_insights = [i for i in insights if i.insight_type.startswith("coping_strategy_")]
        if coping_insights:
            # Select a coping strategy randomly (or by significance)
            top_coping = max(coping_insights, key=lambda x: x.emotional_significance)
            
            notifications.append({
                "type": "coping_strategy",
                "title": "Your Coping Strategy",
                "body": f"When things get tough: {top_coping.value}",
                "priority": self.notification_priorities["coping_strategy"],
                "related_entity_id": str(top_coping.id),
                "metadata": {"strategy_type": top_coping.insight_type}
            })
        
        # Regular check-in prompt (lowest priority)
        notifications.append({
            "type": "check_in",
            "title": "How are you feeling?",
            "body": "Take a moment to check in with your AI therapist about your progress today.",
            "priority": self.notification_priorities["check_in"],
            "related_entity_id": None,
            "metadata": {}
        })
        
        return notifications
    
    def _schedule_at_optimal_times(
        self, 
        user_id: str, 
        notifications: List[Dict[str, Any]],
        engagement_patterns: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Schedule notifications at times when the user is most likely to engage"""
        scheduled_notifications = []
        today = datetime.utcnow()
        
        # Get optimal hours from engagement patterns
        optimal_hours = engagement_patterns["optimal_hours"]
        
        # Schedule each notification at an optimal time
        for i, notification in enumerate(notifications):
            # High priority notifications (risk alerts) should be sent soon
            if notification["priority"] >= 8:  # High priority threshold
                scheduled_time = today + timedelta(minutes=30)  # Send within 30 minutes
            else:
                # Choose from optimal hours, cycling through them if multiple notifications
                hour_index = i % len(optimal_hours)
                optimal_hour = optimal_hours[hour_index]
                
                # Create a time for today at the optimal hour
                scheduled_time = today.replace(
                    hour=optimal_hour, 
                    minute=0, 
                    second=0, 
                    microsecond=0
                )
                
                # If this time is in the past, schedule for tomorrow
                if scheduled_time < today:
                    scheduled_time = scheduled_time + timedelta(days=1)
            
            notification["scheduled_time"] = scheduled_time
            scheduled_notifications.append(notification)
        
        return scheduled_notifications

    async def track_notification_engagement(self, notification_id: str, engaged: bool):
        """Track when a user engages with a notification to improve future scheduling"""
        notification = self.session.exec(
            select(UserNotification).where(UserNotification.id == notification_id)
        ).first()
        
        if not notification:
            logger.warning(f"Notification {notification_id} not found for engagement tracking")
            return
        
        # Record engagement
        engagement = UserNotificationEngagement(
            user_id=notification.user_id,
            notification_id=notification_id,
            engaged=engaged,
            engagement_time=datetime.utcnow()
        )
        
        self.session.add(engagement)
        
        # Update notification as opened
        notification.was_opened = True
        self.session.add(notification)
        
        self.session.commit()
        logger.info(f"Tracked engagement for notification {notification_id}: {engaged}")