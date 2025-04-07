from fastapi import APIRouter

from app.api.routes import login, openai, stripe, users, utils, whstripe, chat
from . import profile

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)
api_router.include_router(stripe.router)
api_router.include_router(whstripe.router)
api_router.include_router(openai.router)
api_router.include_router(profile.router)
api_router.include_router(chat.router)
