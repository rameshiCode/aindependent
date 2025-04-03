# backend/app/api/routes/notifications.py
import logging
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from sqlmodel import Session, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    UserNotification, UserNotificationSettings, ScheduledNotification,
    UserNotificationEngagement
)

router = APIRouter(prefix="/notifications", tags=["notifications"])
logger = logging.getLogger(__name__)


@router.get("/", response_model=List[Dict[str, Any]])
async def get_user_notifications(
    session: SessionDep,
    current_user: CurrentUser,
    limit: int = 50,
    offset: int = 0,
    unread_only: bool = False
):
    """
    Get notifications for the current user.
    
    Args:
        limit: Maximum number of notifications to return
        offset: Number of notifications to skip
        unread_only: Whether to return only unread notifications
    """
    try:
        query = select(UserNotification).where(
            UserNotification.user_id == current_user.id
        ).order_by(UserNotification.created_at.desc())
        
        if unread_only:
            query = query.where(UserNotification.was_opened == False)
            
        notifications = session.exec(query.offset(offset).limit(limit)).all()
        
        return [
            {
                "id": str(notification.id),
                "title": notification.title,
                "body": notification.body,
                "notification_type": notification.notification_type,
                "created_at": notification.created_at.isoformat(),
                "was_opened": notification.was_opened,
                "priority": notification.priority,
                "related_entity_id": notification.related_entity_id
            }
            for notification in notifications
        ]
    except Exception as e:
        logger.error(f"Error getting notifications: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve notifications"
        )


@router.get("/count", response_model=Dict[str, int])
async def get_notification_count(
    session: SessionDep,
    current_user: CurrentUser
):
    """Get count of unread notifications for the current user"""
    try:
        unread_count = session.exec(
            select(UserNotification)
            .where(UserNotification.user_id == current_user.id)
            .where(UserNotification.was_opened == False)
        ).all()
        
        return {"unread_count": len(unread_count)}
    except Exception as e:
        logger.error(f"Error getting notification count: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve notification count"
        )


@router.post("/mark-read/{notification_id}", response_model=Dict[str, Any])
async def mark_notification_read(
    notification_id: str,
    session: SessionDep,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks
):
    """
    Mark a notification as read and track engagement
    
    Args:
        notification_id: ID of the notification to mark as read
    """
    try:
        notification = session.exec(
            select(UserNotification)
            .where(UserNotification.id == notification_id)
            .where(UserNotification.user_id == current_user.id)
        ).first()
        
        if not notification:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )
            
        # Mark notification as opened
        notification.was_opened = True
        session.add(notification)
        
        # Record engagement (in background to not block response)
        background_tasks.add_task(
            record_notification_engagement,
            session,
            current_user.id,
            notification_id,
            True
        )
        
        session.commit()
        
        return {
            "id": notification_id,
            "was_opened": True,
            "success": True
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking notification as read: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark notification as read"
        )


@router.post("/mark-all-read", response_model=Dict[str, Any])
async def mark_all_notifications_read(
    session: SessionDep,
    current_user: CurrentUser
):
    """Mark all notifications as read for the current user"""
    try:
        # Find all unread notifications
        notifications = session.exec(
            select(UserNotification)
            .where(UserNotification.user_id == current_user.id)
            .where(UserNotification.was_opened == False)
        ).all()
        
        # Update each notification
        for notification in notifications:
            notification.was_opened = True
            session.add(notification)
        
        session.commit()
        
        return {
            "success": True,
            "marked_count": len(notifications)
        }
    except Exception as e:
        logger.error(f"Error marking all notifications as read: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark all notifications as read"
        )


@router.get("/settings", response_model=Dict[str, Any])
async def get_notification_settings(
    session: SessionDep,
    current_user: CurrentUser
):
    """Get notification settings for the current user"""
    try:
        settings = session.exec(
            select(UserNotificationSettings)
            .where(UserNotificationSettings.user_id == current_user.id)
        ).first()
        
        if not settings:
            # Create default settings if not found
            settings = UserNotificationSettings(user_id=current_user.id)
            session.add(settings)
            session.commit()
            session.refresh(settings)
            
        return {
            "goal_reminders": settings.goal_reminders,
            "abstinence_milestones": settings.abstinence_milestones,
            "risk_alerts": settings.risk_alerts,
            "daily_check_ins": settings.daily_check_ins,
            "coping_strategies": settings.coping_strategies,
            "educational_content": settings.educational_content,
            "quiet_hours_enabled": settings.quiet_hours_enabled,
            "quiet_hours_start": settings.quiet_hours_start,
            "quiet_hours_end": settings.quiet_hours_end,
            "preferred_time_morning": settings.preferred_time_morning,
            "preferred_time_afternoon": settings.preferred_time_afternoon,
            "preferred_time_evening": settings.preferred_time_evening,
            "max_notifications_per_day": settings.max_notifications_per_day
        }
    except Exception as e:
        logger.error(f"Error getting notification settings: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve notification settings"
        )


@router.post("/settings", response_model=Dict[str, Any])
async def update_notification_settings(
    settings_data: Dict[str, Any],
    session: SessionDep,
    current_user: CurrentUser
):
    """Update notification settings for the current user"""
    try:
        settings = session.exec(
            select(UserNotificationSettings)
            .where(UserNotificationSettings.user_id == current_user.id)
        ).first()
        
        if not settings:
            settings = UserNotificationSettings(user_id=current_user.id)
        
        # Update settings
        if "goal_reminders" in settings_data:
            settings.goal_reminders = settings_data["goal_reminders"]
            
        if "abstinence_milestones" in settings_data:
            settings.abstinence_milestones = settings_data["abstinence_milestones"]
            
        if "risk_alerts" in settings_data:
            settings.risk_alerts = settings_data["risk_alerts"]
            
        if "daily_check_ins" in settings_data:
            settings.daily_check_ins = settings_data["daily_check_ins"]
            
        if "coping_strategies" in settings_data:
            settings.coping_strategies = settings_data["coping_strategies"]
            
        if "educational_content" in settings_data:
            settings.educational_content = settings_data["educational_content"]
            
        if "quiet_hours_enabled" in settings_data:
            settings.quiet_hours_enabled = settings_data["quiet_hours_enabled"]
            
        if "quiet_hours_start" in settings_data:
            settings.quiet_hours_start = settings_data["quiet_hours_start"]
            
        if "quiet_hours_end" in settings_data:
            settings.quiet_hours_end = settings_data["quiet_hours_end"]
            
        if "preferred_time_morning" in settings_data:
            settings.preferred_time_morning = settings_data["preferred_time_morning"]
            
        if "preferred_time_afternoon" in settings_data:
            settings.preferred_time_afternoon = settings_data["preferred_time_afternoon"]
            
        if "preferred_time_evening" in settings_data:
            settings.preferred_time_evening = settings_data["preferred_time_evening"]
            
        if "max_notifications_per_day" in settings_data:
            value = settings_data["max_notifications_per_day"]
            # Ensure value is within acceptable range (1-10)
            settings.max_notifications_per_day = max(1, min(10, value))
        
        session.add(settings)
        session.commit()
        
        return {
            "success": True,
            "message": "Notification settings updated successfully"
        }
    except Exception as e:
        logger.error(f"Error updating notification settings: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update notification settings"
        )


@router.post("/create", response_model=Dict[str, Any])
async def create_notification(
    notification_data: Dict[str, Any],
    session: SessionDep,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks
):
    """
    Create a new notification (admin or system use).
    This endpoint is for testing or administrative purposes.
    """
    try:
        # Validate required fields
        required_fields = ["title", "body", "notification_type"]
        for field in required_fields:
            if field not in notification_data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing required field: {field}"
                )
        
        # Create notification
        notification = UserNotification(
            user_id=notification_data.get("user_id", current_user.id),
            title=notification_data["title"],
            body=notification_data["body"],
            notification_type=notification_data["notification_type"],
            related_entity_id=notification_data.get("related_entity_id"),
            priority=notification_data.get("priority", 3),
            was_sent=True,
            was_opened=False
        )
        
        session.add(notification)
        session.commit()
        session.refresh(notification)
        
        return {
            "id": str(notification.id),
            "success": True,
            "message": "Notification created successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating notification: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create notification"
        )


async def record_notification_engagement(
    session: Session,
    user_id: str,
    notification_id: str,
    engaged: bool
):
    """
    Record engagement with a notification for analytics and personalization.
    
    Args:
        session: Database session
        user_id: User ID
        notification_id: Notification ID
        engaged: Whether the user engaged with the notification
    """
    try:
        # Create engagement record
        engagement = UserNotificationEngagement(
            user_id=user_id,
            notification_id=notification_id,
            engaged=engaged,
            engagement_time=datetime.utcnow()
        )
        
        session.add(engagement)
        session.commit()
        
        logger.info(f"Recorded notification engagement: user={user_id}, notification={notification_id}, engaged={engaged}")
    except Exception as e:
        logger.error(f"Error recording notification engagement: {str(e)}")
        # Don't raise exception - this is a background task