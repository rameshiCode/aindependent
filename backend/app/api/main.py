from fastapi import APIRouter

from app.api.routes import (
    login,
    notifications,
    openai,
    profiles,
    stripe,
    users,
    utils,
    whstripe,
)

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)
api_router.include_router(stripe.router)
api_router.include_router(whstripe.router)
api_router.include_router(openai.router)
api_router.include_router(profiles.router)
api_router.include_router(notifications.router)
