# app/api/routes/notifications.py
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from sqlmodel import and_, select

from app.api.deps import CurrentUser, SessionDep
from app.models import UserNotification

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/", response_model=list[dict])
def get_user_notifications(
    session: SessionDep,
    current_user: CurrentUser,
    limit: int = 50,
    offset: int = 0,
    unread_only: bool = False,
):
    """Get notifications for the current user"""
    query = select(UserNotification).where(UserNotification.user_id == current_user.id)

    if unread_only:
        query = query.where(UserNotification.was_opened == False)

    query = (
        query.order_by(UserNotification.scheduled_for.desc())
        .offset(offset)
        .limit(limit)
    )
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


@router.get("/count", response_model=dict)
def get_notification_count(
    session: SessionDep,
    current_user: CurrentUser,
):
    """Get count of unread notifications for the current user"""
    query = select(UserNotification).where(
        and_(
            UserNotification.user_id == current_user.id,
            UserNotification.was_opened == False,
            UserNotification.was_sent == True,
        )
    )
    count = len(session.exec(query).all())

    return {"unread_count": count}


@router.post("/mark-read/{notification_id}", response_model=dict)
def mark_notification_read(
    notification_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
):
    """Mark a notification as read"""
    notification = session.exec(
        select(UserNotification)
        .where(UserNotification.id == notification_id)
        .where(UserNotification.user_id == current_user.id)
    ).first()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found"
        )

    notification.was_opened = True
    session.add(notification)
    session.commit()

    return {"success": True}


@router.post("/mark-all-read", response_model=dict)
def mark_all_notifications_read(
    session: SessionDep,
    current_user: CurrentUser,
):
    """Mark all notifications as read for the current user"""
    notifications = session.exec(
        select(UserNotification)
        .where(UserNotification.user_id == current_user.id)
        .where(UserNotification.was_opened == False)
    ).all()

    for notification in notifications:
        notification.was_opened = True
        session.add(notification)

    session.commit()

    return {"success": True, "count": len(notifications)}


@router.post("/create", response_model=dict)
def create_notification(
    data: dict,
    session: SessionDep,
    current_user: CurrentUser,
):
    """Create a new notification (admin or system use)"""
    # Check if user is admin or if this is a system call
    # This would need proper authorization in production

    required_fields = ["title", "body", "notification_type"]
    for field in required_fields:
        if field not in data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required field: {field}",
            )

    user_id = data.get("user_id", str(current_user.id))

    # Convert string UUID to UUID object
    try:
        user_id = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user_id format"
        )

    notification = UserNotification(
        user_id=user_id,
        title=data["title"],
        body=data["body"],
        notification_type=data["notification_type"],
        scheduled_for=datetime.fromisoformat(
            data.get("scheduled_for", datetime.utcnow().isoformat())
        ),
        priority=data.get("priority", 3),
        related_entity_id=uuid.UUID(data["related_entity_id"])
        if "related_entity_id" in data
        else None,
        was_sent=data.get("was_sent", False),
        was_opened=data.get("was_opened", False),
    )

    session.add(notification)
    session.commit()
    session.refresh(notification)

    return {"id": str(notification.id), "title": notification.title, "success": True}
