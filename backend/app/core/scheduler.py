# backend/app/core/scheduler.py
import logging
from collections.abc import Callable, Coroutine

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI

from app.api.background_tasks import run_periodic_tasks, send_pending_notifications

logger = logging.getLogger(__name__)


class BackgroundTaskScheduler:
    """
    Manages scheduling and execution of background tasks.
    Uses APScheduler to handle time-based scheduling.
    """

    def __init__(self, app: FastAPI = None):
        self.scheduler = AsyncIOScheduler()
        self.app = app
        self.timezone = pytz.UTC

        # Store the tasks for potential later manipulation
        self.tasks = {}

        # Register default tasks
        self._register_default_tasks()

    def _register_default_tasks(self):
        """Register the default background tasks"""

        # Process notifications every 15 minutes
        self.add_job(
            func=send_pending_notifications,
            trigger="interval",
            minutes=15,
            id="send_pending_notifications",
            name="Send pending notifications",
            replace_existing=True,
        )

        # Check for at-risk periods and goal deadlines hourly
        self.add_job(
            func=run_periodic_tasks,
            trigger="interval",
            hours=1,
            id="run_periodic_tasks",
            name="Run periodic user checks",
            replace_existing=True,
        )

    def add_job(self, func: Callable[..., Coroutine], trigger: str, **kwargs):
        """
        Add a job to the scheduler.

        Args:
            func: The async function to execute
            trigger: The trigger type (e.g., 'interval', 'cron', 'date')
            **kwargs: Additional arguments for APScheduler
        """
        job_id = kwargs.get("id", func.__name__)
        self.tasks[job_id] = {"func": func, "trigger": trigger, "kwargs": kwargs}

        if self.scheduler.running:
            self.scheduler.add_job(func, trigger, **kwargs)
            logger.info(f"Added job {job_id} to the running scheduler")

    def start(self):
        """Start the scheduler"""
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("Background task scheduler started")

            # Add all registered tasks
            for job_id, task in self.tasks.items():
                self.scheduler.add_job(task["func"], task["trigger"], **task["kwargs"])
                logger.info(f"Added job {job_id} to the scheduler")

    def shutdown(self):
        """Shutdown the scheduler gracefully"""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=True)
            logger.info("Background task scheduler shut down")


# Global scheduler instance
background_scheduler = BackgroundTaskScheduler()


def setup_scheduler(app: FastAPI):
    """
    Set up the scheduler for the FastAPI application.

    Args:
        app: The FastAPI application instance
    """
    background_scheduler.app = app

    @app.on_event("startup")
    async def startup_scheduler():
        """Start the scheduler on app startup"""
        background_scheduler.start()

    @app.on_event("shutdown")
    async def shutdown_scheduler():
        """Shutdown the scheduler on app shutdown"""
        background_scheduler.shutdown()
