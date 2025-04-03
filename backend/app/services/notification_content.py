import json
import logging
import asyncio
from datetime import datetime, timedelta
import random
from typing import Dict, List, Any, Optional, Tuple
from sqlmodel import Session, select

from app.models import (
    UserProfile, UserInsight, UserGoal, 
    ScheduledNotification, UserNotification
)
from app.services.openai_client import get_openai_client

logger = logging.getLogger(__name__)

class PersonalizedNotificationContent:
    """
    Advanced notification content generator that creates dynamic, personalized
    notification messages based on user profile, insights, and recovery stage.
    """
    
    def __init__(self, session: Session):
        self.session = session
        
        # Template categories with multiple variations to avoid repetition
        self.templates = {
            "abstinence_milestone": [
                "{days} Days Strong! 🎉 {custom_message}",
                "Day {days}: Milestone Achieved! {custom_message}",
                "Congratulations on {days} Days! {custom_message}",
                "{days} Days of Progress! {custom_message}",
                "You've reached {days} days! {custom_message}"
            ],
            "relapse_risk": [
                "Notice your triggers: {trigger_insight}",
                "Remember your strategy: {coping_strategy}",
                "High-risk moment? {coping_strategy}",
                "Stay strong: {motivation_insight}",
                "This feeling will pass: {coping_strategy}"
            ],
            "goal_reminder": [
                "Goal check-in: {goal_description}",
                "Remember your goal: {goal_description}",
                "{goal_deadline}: {goal_description}",
                "Goal progress: {goal_description}",
                "Working towards: {goal_description}"
            ],
            "motivation_boost": [
                "Remember why: {motivation_insight}",
                "Your motivation: {motivation_insight}",
                "Keep going: {motivation_insight}",
                "Your 'why': {motivation_insight}",
                "Remember: {motivation_insight}"
            ],
            "coping_strategy": [
                "Helpful strategy: {coping_strategy}",
                "Try this: {coping_strategy}",
                "Your toolbox: {coping_strategy}",
                "When it's tough: {coping_strategy}",
                "What works: {coping_strategy}"
            ],
            "check_in": [
                "How are you feeling today?",
                "Time for a quick check-in",
                "A moment to reflect on your journey",
                "Your therapist is here for you",
                "Take a moment for yourself"
            ]
        }
        
        # Motivational quotes for various situations
        self.quotes = {
            "early_recovery": [
                "The journey of a thousand miles begins with a single step.",
                "You don't have to be perfect to make progress.",
                "Every day is a new beginning.",
                "Small steps lead to big changes.",
                "Recovery is not a race, it's a journey."
            ],
            "middle_recovery": [
                "Persistence is what makes the impossible possible.",
                "Your strength is greater than your struggle.",
                "Progress, not perfection.",
                "Every challenge you overcome makes you stronger.",
                "The hard days are what make you stronger."
            ],
            "sustained_recovery": [
                "Success is the sum of small efforts repeated day after day.",
                "Your journey is inspiring others, even if you don't realize it.",
                "Transformation is a process, not an event.",
                "You've come too far to only come this far.",
                "What you're building now is becoming your legacy."
            ],
            "after_setback": [
                "Falling down is part of life, getting back up is living.",
                "Your setback is the setup for your comeback.",
                "The only failure is giving up.",
                "It's not how many times you fall, it's how many times you get back up.",
                "Every setback is a setup for a comeback."
            ]
        }
    
    async def generate_notification_content(
        self, 
        notification_type: str, 
        user_id: str,
        related_entity_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, str]:
        """
        Generate personalized notification title and body based on user data
        and notification type.
        
        Args:
            notification_type: Type of notification to generate
            user_id: User ID to generate notification for
            related_entity_id: Optional related entity ID (goal, insight, etc.)
            metadata: Optional additional data for notification generation
            
        Returns:
            Tuple of (title, body) with personalized notification content
        """
        # Get user profile data
        profile = self._get_user_profile(user_id)
        if not profile:
            logger.warning(f"No profile found for user {user_id}, using generic notification")
            return self._generate_generic_notification(notification_type)
            
        # Get supporting data based on notification type
        insights = self._get_relevant_insights(user_id, notification_type, related_entity_id)
        goals = self._get_user_goals(user_id, related_entity_id) if "goal" in notification_type else []
        recovery_stage = self._determine_recovery_stage(profile)
        
        # For high-priority notifications or complex ones, use AI generation
        if (notification_type in ["relapse_risk_critical", "relapse_risk_high", "abstinence_milestone"] 
            or metadata and metadata.get("use_ai_generation", False)):
            try:
                return await self._generate_ai_notification(
                    notification_type, profile, insights, goals, recovery_stage, metadata
                )
            except Exception as e:
                logger.error(f"Error generating AI notification: {str(e)}")
                # Fall back to template-based notification
        
        # For standard notifications, use template-based generation
        return self._generate_template_notification(
            notification_type, profile, insights, goals, recovery_stage, metadata
        )
    
    def _get_user_profile(self, user_id: str) -> Optional[UserProfile]:
        """Get user profile from database"""
        return self.session.exec(
            select(UserProfile).where(UserProfile.user_id == user_id)
        ).first()
    
    def _get_relevant_insights(
        self, 
        user_id: str, 
        notification_type: str,
        related_entity_id: Optional[str] = None
    ) -> List[UserInsight]:
        """Get relevant insights based on notification type"""
        query = select(UserInsight).where(UserInsight.user_id == user_id)
        
        # Filter by specific insight if provided
        if related_entity_id:
            query = query.where(UserInsight.id == related_entity_id)
        
        # Filter by insight type based on notification type
        if "relapse_risk" in notification_type:
            query = query.where(
                (UserInsight.insight_type.like("trigger_%")) | 
                (UserInsight.insight_type.like("coping_strategy_%"))
            )
        elif "motivation" in notification_type:
            query = query.where(UserInsight.insight_type.like("motivation_%"))
        elif "coping" in notification_type:
            query = query.where(UserInsight.insight_type.like("coping_strategy_%"))
            
        # Order by emotional significance and recency
        query = query.order_by(UserInsight.emotional_significance.desc(), UserInsight.extracted_at.desc())
        
        # Limit to most relevant insights
        return self.session.exec(query.limit(5)).all()
    
    def _get_user_goals(self, user_id: str, goal_id: Optional[str] = None) -> List[UserGoal]:
        """Get user goals, either specific goal or active goals"""
        query = select(UserGoal).where(UserGoal.user_id == user_id)
        
        if goal_id:
            query = query.where(UserGoal.id == goal_id)
        else:
            query = query.where(UserGoal.status == "active")
            
        return self.session.exec(query).all()
    
    def _determine_recovery_stage(self, profile: UserProfile) -> str:
        """Determine user's recovery stage based on abstinence days and other factors"""
        if not profile.abstinence_days or profile.abstinence_days < 0:
            return "early_recovery"
            
        if profile.abstinence_days <= 30:
            return "early_recovery"
        elif profile.abstinence_days <= 90:
            return "middle_recovery"
        else:
            return "sustained_recovery"
    
    def _generate_generic_notification(self, notification_type: str) -> Tuple[str, str]:
        """Generate a generic notification when user data is not available"""
        if "abstinence_milestone" in notification_type:
            return "Milestone Achieved!", "Congratulations on your progress. Keep going!"
        elif "relapse_risk" in notification_type:
            return "Check-in Time", "Remember your coping strategies during challenging moments."
        elif "goal" in notification_type:
            return "Goal Reminder", "Don't forget about your recovery goals."
        elif "motivation" in notification_type:
            return "Motivation Boost", "Remember why you started this journey."
        elif "coping" in notification_type:
            return "Coping Strategy", "Use your coping tools when facing challenges."
        else:
            return "AIndependent", "Your AI therapist is here for you."
    
    def _generate_template_notification(
        self,
        notification_type: str,
        profile: UserProfile,
        insights: List[UserInsight],
        goals: List[UserGoal],
        recovery_stage: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, str]:
        """Generate notification using templates and user data"""
        # Default values
        title = "AIndependent"
        body = "Your AI therapist is here for you."
        
        # Get template variations for this notification type
        template_key = next((k for k in self.templates.keys() if k in notification_type), "check_in")
        templates = self.templates.get(template_key, self.templates["check_in"])
        
        # Pick a random template to avoid repetition
        template = random.choice(templates)
        
        # Get a relevant quote based on recovery stage
        quote = random.choice(self.quotes.get(recovery_stage, self.quotes["early_recovery"]))
        
        # Format variables for template
        format_vars = {
            "days": profile.abstinence_days or 0,
            "custom_message": quote,
            "trigger_insight": insights[0].value if insights and "trigger" in insights[0].insight_type else "Be mindful of your triggers",
            "coping_strategy": insights[0].value if insights and "coping" in insights[0].insight_type else "Use your coping strategies",
            "motivation_insight": insights[0].value if insights and "motivation" in insights[0].insight_type else "Remember why you started",
            "goal_description": goals[0].description if goals else "your recovery goals",
            "goal_deadline": "Due soon" if goals and goals[0].target_date and (goals[0].target_date - datetime.utcnow()).days <= 2 else "In progress"
        }
        
        # Add any metadata variables
        if metadata:
            format_vars.update(metadata)
        
        # Generate notification based on type
        if "abstinence_milestone" in notification_type:
            milestone = profile.abstinence_days or 0
            title = f"{milestone} Day Milestone! 🎉"
            body = template.format(**format_vars)
            
        elif "relapse_risk" in notification_type:
            if "critical" in notification_type:
                title = "Important Check-in"
            else:
                title = "Remember Your Strength"
            body = template.format(**format_vars)
            
        elif "goal" in notification_type:
            title = "Goal Update"
            if goals:
                goal = goals[0]
                if goal.target_date:
                    days_left = (goal.target_date - datetime.utcnow()).days
                    if days_left <= 0:
                        title = "Goal Due Today"
                    elif days_left == 1:
                        title = "Goal Due Tomorrow"
                    else:
                        title = f"Goal: {days_left} Days Left"
            body = template.format(**format_vars)
            
        elif "motivation" in notification_type:
            title = "Motivation Reminder"
            body = template.format(**format_vars)
            
        elif "coping" in notification_type:
            title = "Your Coping Strategy"
            body = template.format(**format_vars)
            
        else:
            title = "Check In"
            body = template
        
        return title, body
    
    async def _generate_ai_notification(
        self,
        notification_type: str,
        profile: UserProfile,
        insights: List[UserInsight],
        goals: List[UserGoal],
        recovery_stage: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, str]:
        """Generate highly personalized notification content using AI"""
        # Prepare context for AI
        context = self._prepare_ai_context(notification_type, profile, insights, goals, recovery_stage, metadata)
        
        # Call OpenAI API
        client = get_openai_client()
        if not client:
            logger.error("OpenAI client not available for AI notification generation")
            return self._generate_template_notification(
                notification_type, profile, insights, goals, recovery_stage, metadata
            )
        
        try:
            response = await client.chat.completions.create(
                model="gpt-3.5-turbo",  # Using 3.5 for cost-efficiency
                messages=[
                    {"role": "system", "content": context["system_prompt"]},
                    {"role": "user", "content": context["user_prompt"]}
                ],
                temperature=0.7,  # Allow some creativity
                max_tokens=150,  # Keep notifications concise
            )
            
            # Extract and parse response
            response_text = response.choices[0].message.content
            
            # Parse title and body from response
            parts = response_text.split("\n\n", 1)
            if len(parts) >= 2:
                title = parts[0].replace("Title: ", "").strip()
                body = parts[1].replace("Body: ", "").strip()
            else:
                # Fallback parsing if format is different
                parts = response_text.split("\n", 1)
                if len(parts) >= 2:
                    title = parts[0].replace("Title: ", "").strip()
                    body = parts[1].replace("Body: ", "").strip()
                else:
                    # Last resort fallback
                    title = "AIndependent"
                    body = response_text.strip()
            
            # Ensure title isn't too long (push-mobile limitations)
            if len(title) > 50:
                title = title[:47] + "..."
                
            # Ensure body isn't too long
            if len(body) > 150:
                body = body[:147] + "..."
                
            return title, body
                
        except Exception as e:
            logger.error(f"Error generating AI notification: {str(e)}")
            # Fall back to template notification
            return self._generate_template_notification(
                notification_type, profile, insights, goals, recovery_stage, metadata
            )
    
    def _prepare_ai_context(
        self,
        notification_type: str,
        profile: UserProfile,
        insights: List[UserInsight],
        goals: List[UserGoal],
        recovery_stage: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, str]:
        """Prepare context for AI notification generation"""
        # System prompt guides the AI on notification generation
        system_prompt = """
        You are an empathetic addiction recovery specialist crafting mobile push notifications for an addiction recovery app. 
        Your goal is to create brief, impactful notifications that motivate users in their recovery journey while being sensitive to their specific situation.
        
        Guidelines:
        - Create a title (max 50 chars) and body (max 150 chars)
        - Use compassionate, non-judgmental language
        - Be specific to the user's situation and recovery stage
        - For milestone notifications, celebrate achievements genuinely
        - For risk notifications, balance caution with encouragement
        - For goal notifications, focus on progress and next steps
        - Avoid clichés and generic recovery platitudes
        - Never use language that might trigger shame or guilt
        - Keep content positive or neutral, never negative
        
        Format your response as:
        Title: [notification title]
        
        Body: [notification body]
        """
        
        # User prompt contains specific details about this notification
        user_prompt = f"""
        Create a notification for a user with the following details:
        
        Notification type: {notification_type}
        Recovery stage: {recovery_stage}
        Abstinence days: {profile.abstinence_days or 0}
        Addiction type: {profile.addiction_type or 'substance use'}
        """
        
        # Add more context based on notification type and available data
        if "abstinence_milestone" in notification_type:
            milestone = profile.abstinence_days or 0
            user_prompt += f"\nThis is a milestone celebration for {milestone} days of abstinence."
            
        elif "relapse_risk" in notification_type:
            risk_level = "high" if "high" in notification_type else "critical"
            user_prompt += f"\nThis is a {risk_level} risk notification to help prevent relapse."
            
            # Add trigger insights if available
            trigger_insights = [i for i in insights if "trigger" in i.insight_type]
            if trigger_insights:
                user_prompt += f"\nUser's trigger: {trigger_insights[0].value}"
                
            # Add coping strategies if available
            coping_insights = [i for i in insights if "coping" in i.insight_type]
            if coping_insights:
                user_prompt += f"\nUser's coping strategy: {coping_insights[0].value}"
        
        elif "goal" in notification_type and goals:
            goal = goals[0]
            days_left = 0
            if goal.target_date:
                days_left = (goal.target_date - datetime.utcnow()).days
                deadline_text = f"due in {days_left} days" if days_left > 0 else "due today"
                user_prompt += f"\nThis is a goal reminder for: '{goal.description}' ({deadline_text})."
            else:
                user_prompt += f"\nThis is a goal reminder for: '{goal.description}' (no deadline)."
        
        elif "motivation" in notification_type:
            # Add motivation insights if available
            motivation_insights = [i for i in insights if "motivation" in i.insight_type]
            if motivation_insights:
                user_prompt += f"\nUser's motivation: {motivation_insights[0].value}"
            
            # Add motivation level if available
            if profile.motivation_level is not None:
                user_prompt += f"\nMotivation level: {profile.motivation_level}/10"
                
        elif "coping" in notification_type:
            # Add coping insights if available
            coping_insights = [i for i in insights if "coping" in i.insight_type]
            if coping_insights:
                user_prompt += f"\nUser's coping strategy to remind them of: {coping_insights[0].value}"
        
        # Add metadata if provided
        if metadata:
            if "high_risk_period" in metadata:
                user_prompt += f"\nUser has identified {metadata['high_risk_period']} as a high-risk period."
            
            if "approaching_milestone" in metadata:
                user_prompt += f"\nUser is approaching their {metadata['approaching_milestone']}-day milestone in {metadata.get('days_to_go', 'a few')} days."
                
            if "milestone_days" in metadata:
                user_prompt += f"\nThis is a specific {metadata['milestone_days']}-day milestone celebration."
        
        return {
            "system_prompt": system_prompt,
            "user_prompt": user_prompt
        }


async def send_personalized_notification(
    session: Session,
    user_id: str,
    notification_id: str
):
    """
    Process and send a notification with personalized content.
    This function is called by the notification sending service.
    """
    # Get the notification to send
    notification = session.exec(
        select(ScheduledNotification).where(ScheduledNotification.id == notification_id)
    ).first()
    
    if not notification:
        logger.error(f"Notification {notification_id} not found")
        return
    
    try:
        # Generate personalized content
        content_generator = PersonalizedNotificationContent(session)
        
        # Parse metadata if present
        metadata = {}
        if notification.metadata:
            try:
                metadata = json.loads(notification.metadata)
            except json.JSONDecodeError:
                logger.warning(f"Could not parse metadata for notification {notification_id}")
        
        # Generate personalized title and body
        title, body = await content_generator.generate_notification_content(
            notification_type=notification.notification_type,
            user_id=user_id,
            related_entity_id=notification.related_entity_id,
            metadata=metadata
        )
        
        # Create user notification record
        user_notification = UserNotification(
            user_id=user_id,
            title=title,
            body=body,
            notification_type=notification.notification_type,
            related_entity_id=notification.related_entity_id,
            priority=notification.priority,
            was_sent=True,
            was_opened=False
        )
        
        session.add(user_notification)
        
        # Mark scheduled notification as sent
        notification.sent = True
        session.add(notification)
        
        session.commit()
        
        # In a real implementation, here you would call your push notification service
        # (Firebase Cloud Messaging, OneSignal, etc.)
        logger.info(f"Sent personalized notification to user {user_id}: {title}")
        
        # Return the notification for further processing if needed
        return user_notification
        
    except Exception as e:
        logger.error(f"Error sending personalized notification {notification_id}: {str(e)}")
        logger.exception("Notification error details:")

class NotificationScheduleManager:
    """
    A class for managing notification schedules including scheduling,
    tracking, and throttling to avoid notification fatigue.
    """
    
    def __init__(self, session: Session):
        self.session = session
        self.content_generator = PersonalizedNotificationContent(session)
        
    async def process_pending_notifications(self):
        """Process all pending notifications that are due to be sent"""
        current_time = datetime.utcnow()
        
        # Find notifications that are due but not sent
        pending_notifications = self.session.exec(
            select(ScheduledNotification)
            .where(ScheduledNotification.scheduled_for <= current_time)
            .where(ScheduledNotification.sent == False)
        ).all()
        
        logger.info(f"Found {len(pending_notifications)} pending notifications to send")
        
        # Group notifications by user to avoid sending too many at once
        user_notifications = {}
        for notification in pending_notifications:
            if notification.user_id not in user_notifications:
                user_notifications[notification.user_id] = []
            
            user_notifications[notification.user_id].append(notification)
        
        # Process notifications for each user
        for user_id, notifications in user_notifications.items():
            # Sort by priority
            notifications.sort(key=lambda n: n.priority, reverse=True)
            
            # Avoid notification fatigue - limit to 3 per batch
            notifications_to_send = notifications[:3]
            
            # Send each notification
            for notification in notifications_to_send:
                try:
                    await send_personalized_notification(
                        self.session, user_id, str(notification.id)
                    )
                except Exception as e:
                    logger.error(f"Error sending notification {notification.id}: {e}")
            
            # If there are more notifications, reschedule them for later
            if len(notifications) > 3:
                self._reschedule_excess_notifications(notifications[3:])
    
    def _reschedule_excess_notifications(self, notifications: List[ScheduledNotification]):
        """Reschedule excess notifications to avoid notification fatigue"""
        for i, notification in enumerate(notifications):
            # Reschedule with increasing delays (1h, 2h, 3h, etc.)
            delay_hours = i + 1
            new_time = datetime.utcnow() + timedelta(hours=delay_hours)
            
            notification.scheduled_for = new_time
            self.session.add(notification)
        
        self.session.commit()
        logger.info(f"Rescheduled {len(notifications)} excess notifications")


async def main():
    """Example main function for running the notification system"""
    # This would be called by your scheduler (e.g., a Celery task)
    from sqlmodel import create_engine, SQLModel, Session
    
    engine = create_engine("sqlite:///./test.db")
    SQLModel.metadata.create_all(engine)
    
    # Process pending notifications every hour
    while True:
        try:
            with Session(engine) as session:
                manager = NotificationScheduleManager(session)
                await manager.process_pending_notifications()
        except Exception as e:
            logger.error(f"Error in notification processing: {e}")
        
        # Wait for next run
        await asyncio.sleep(3600)  # 1 hour


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())