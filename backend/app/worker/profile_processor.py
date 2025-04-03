# app/worker/profile_processor.py
import asyncio
import logging
from datetime import datetime, timedelta

from sqlmodel import Session, select

from app.core.db import engine
from app.models import Conversation
from app.services.notifications_scheduler import NotificationScheduler
from app.services.profile_extractor import process_conversation_for_profile

logger = logging.getLogger(__name__)


async def process_recent_conversations():
    """Process recently updated conversations to extract profile insights"""
    with Session(engine) as session:
        # Get conversations that have been updated in the last 24 hours
        yesterday = datetime.utcnow() - timedelta(days=1)

        # Find conversations with recent updates
        conversations = session.exec(
            select(Conversation).where(Conversation.updated_at >= yesterday)
        ).all()

        logger.info(f"Found {len(conversations)} recent conversations to process")

        # Process each conversation
        for conversation in conversations:
            try:
                # Extract profile insights from the conversation
                await process_conversation_for_profile(
                    session_factory=lambda: Session(engine),
                    conversation_id=str(conversation.id),
                    user_id=str(conversation.user_id),
                )

                # Schedule notifications based on updated profile
                scheduler = NotificationScheduler(session)
                await scheduler.schedule_notifications_for_user(
                    user_id=str(conversation.user_id)
                )

            except Exception as e:
                logger.error(f"Error processing conversation {conversation.id}: {e}")


async def send_pending_notifications():
    """Send notifications that are due"""
    with Session(engine) as session:
        # Find notifications that are due but not sent
        current_time = datetime.utcnow()

        from app.models import ScheduledNotification

        pending_notifications = session.exec(
            select(ScheduledNotification)
            .where(ScheduledNotification.scheduled_for <= current_time)
            .where(ScheduledNotification.sent == False)
        ).all()

        logger.info(f"Found {len(pending_notifications)} pending notifications to send")

        # In a real implementation, you would integrate with a push notification service
        # like Firebase Cloud Messaging, OneSignal, etc.
        for notification in pending_notifications:
            try:
                # This is where you would call your notification service
                logger.info(
                    f"Sending notification: {notification.title} to user {notification.user_id}"
                )

                # For now, just mark as sent
                notification.sent = True
                session.add(notification)

            except Exception as e:
                logger.error(f"Error sending notification {notification.id}: {e}")

        session.commit()


async def main():
    """Main function to start background processing"""
    while True:
        try:
            # Process recent conversations
            await process_recent_conversations()

            # Send pending notifications
            await send_pending_notifications()

        except Exception as e:
            logger.error(f"Error in profile processor: {e}")

        # Sleep for a while before checking again
        await asyncio.sleep(3600)  # Run once per hour


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
