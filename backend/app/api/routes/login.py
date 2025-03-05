from datetime import timedelta
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm

from app import crud
from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser, get_db
from app.core import security
from app.core.config import settings
from app.core.security import get_password_hash
from app.models import Message, NewPassword, Token, User, UserPublic
from app.utils import (
    generate_password_reset_token,
    generate_reset_password_email,
    send_email,
    verify_password_reset_token,
)

router = APIRouter(tags=["login"])

@router.get("/login/google")
async def login_google():
    """
    Redirect users to Google for authentication
    """
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "response_type": "code",
        "scope": "openid email profile",
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "prompt": "select_account",
    }
    
    authorize_url = f"{settings.GOOGLE_AUTH_URL}?" + "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(authorize_url)


@router.get("/login/auth/google")
async def auth_google(request: Request, session: SessionDep, code: str = None, error: str = None):
    """
    Handle Google OAuth2 callback and issue a JWT token.
    """
    # Handle error from Google
    if error:
        print(f"Google authentication error: {error}")
        return HTMLResponse(
            content=f"<html><body><h1>Authentication Error</h1><p>{error}</p></body></html>",
            status_code=400
        )
    
    if not code:
        return HTMLResponse(
            content="<html><body><h1>Authentication Error</h1><p>No code received</p></body></html>",
            status_code=400
        )
    
    # Debug info
    print(f"Received auth code in main handler: {code[:10]}...")
    print(f"Using redirect URI in token exchange: {settings.GOOGLE_REDIRECT_URI}")
    
    token_data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient() as client:
        # Exchange authorization code for access token
        token_response = await client.post(settings.GOOGLE_TOKEN_URL, data=token_data)
        if token_response.status_code != 200:
            error_body = token_response.text
            print(f"Google token error: {error_body}")
            return HTMLResponse(
                content=f"<html><body><h1>Token Exchange Error</h1><p>Status: {token_response.status_code}</p><pre>{error_body}</pre></body></html>",
                status_code=400
            )
        token_json = token_response.json()
        
        # Fetch user info from Google
        userinfo_response = await client.get(settings.GOOGLE_USER_INFO_URL, headers={"Authorization": f"Bearer {token_json['access_token']}"})
        if userinfo_response.status_code != 200:
            raise HTTPException(status_code=userinfo_response.status_code, detail="Failed to retrieve user info.")
        user_json = userinfo_response.json()

        # TODO: properly create a user, add schemas
        user_email = user_json.get("email")
        if not user_email:
            raise HTTPException(status_code=400, detail="Email not available in user info.")

        # Check if user exists in database
        user = crud.get_user_by_email(session=session, email=user_email)
        if not user:
            user = User(
                email=user_email,
                full_name=user_json.get("name", ""),
                is_active=True,
                google_id=user_json["sub"]
            )
            session.add(user)
            session.commit()

        # Generate JWT token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        jwt_token = security.create_access_token(subject=user.id, expires_delta=access_token_expires)

        # Check if this is a web browser 
        user_agent = request.headers.get("user-agent", "").lower()
        if "mozilla" in user_agent:
            # For web browser in development mode, redirect directly to frontend with token
            frontend_url = "http://localhost:8081"
            
            print("Web browser detected, redirecting to frontend")
            print(f"User agent: {user_agent}")
            
            # Redirect directly to the tabs route in the frontend
            redirect_url = f"{frontend_url}/(tabs)?token={jwt_token}"
            print(f"Redirecting to: {redirect_url}")
            
            # Use 303 status to ensure a GET request is made to the redirect URL
            return RedirectResponse(url=redirect_url, status_code=303)

        # If not a web browser request, return the token as JSON
        return Token(access_token=jwt_token, token_type="bearer")


@router.post("/login/access-token")
async def login_for_access_token(
     session: SessionDep, form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> Token:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    user = crud.authenticate(
        session=session, email=form_data.username, password=form_data.password
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(user.id, expires_delta=access_token_expires)
    return Token(access_token=access_token, token_type="bearer")


@router.post("/login/test-token", response_model=UserPublic)
def test_token(current_user: CurrentUser) -> Any:
    """
    Test access token
    """
    return current_user


@router.post("/password-recovery/{email}")
def recover_password(email: str, session: SessionDep) -> Message:
    """
    Password Recovery
    """
    user = crud.get_user_by_email(session=session, email=email)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this email does not exist in the system.",
        )
    password_reset_token = generate_password_reset_token(email=email)
    email_data = generate_reset_password_email(
        email_to=user.email, email=email, token=password_reset_token
    )
    send_email(
        email_to=user.email,
        subject=email_data.subject,
        html_content=email_data.html_content,
    )
    return Message(message="Password recovery email sent")


@router.post("/reset-password/")
def reset_password(session: SessionDep, body: NewPassword) -> Message:
    """
    Reset password
    """
    email = verify_password_reset_token(token=body.token)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid token")
    user = crud.get_user_by_email(session=session, email=email)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this email does not exist in the system.",
        )
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    hashed_password = get_password_hash(password=body.new_password)
    user.hashed_password = hashed_password
    session.add(user)
    session.commit()
    return Message(message="Password updated successfully")


@router.post(
    "/password-recovery-html-content/{email}",
    dependencies=[Depends(get_current_active_superuser)],
    response_class=HTMLResponse,
)
def recover_password_html_content(email: str, session: SessionDep) -> Any:
    """
    HTML Content for Password Recovery
    """
    user = crud.get_user_by_email(session=session, email=email)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="The user with this username does not exist in the system.",
        )
    password_reset_token = generate_password_reset_token(email=email)
    email_data = generate_reset_password_email(
        email_to=user.email, email=email, token=password_reset_token
    )

    return HTMLResponse(
        content=email_data.html_content, headers={"subject:": email_data.subject}
    )


@router.get("/login/mobile/google/callback")
async def auth_google_mobile(request: Request, code: str = None, error: str = None):
    """
    Handle Google OAuth2 callback specifically for mobile apps.
    Returns a redirect with the JWT token as a parameter.
    """
    # Handle error from Google
    if error:
        print(f"Google authentication error: {error}")
        return HTMLResponse(
            content=f"<html><body><h1>Authentication Error</h1><p>{error}</p></body></html>",
            status_code=400
        )
    
    if not code:
        return HTMLResponse(
            content="<html><body><h1>Authentication Error</h1><p>No code received</p></body></html>",
            status_code=400
        )
    
    # For the mobile flow, use the same redirect URI that was used to get the code
    mobile_redirect_uri = f"{settings.BACKEND_HOST}{settings.API_V1_STR}/login/mobile/google/callback"
    
    # Debug info
    print(f"Received auth code: {code[:10]}...")
    print(f"Using mobile redirect URI in token exchange: {mobile_redirect_uri}")
    
    token_data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": mobile_redirect_uri,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient() as client:
        # Exchange authorization code for access token
        token_response = await client.post(settings.GOOGLE_TOKEN_URL, data=token_data)
        if token_response.status_code != 200:
            raise HTTPException(status_code=token_response.status_code, detail="Failed to retrieve access token.")
        token_json = token_response.json()
        
        # Fetch user info from Google
        userinfo_response = await client.get(settings.GOOGLE_USER_INFO_URL, headers={"Authorization": f"Bearer {token_json['access_token']}"})
        if userinfo_response.status_code != 200:
            raise HTTPException(status_code=userinfo_response.status_code, detail="Failed to retrieve user info.")
        user_json = userinfo_response.json()

        user_email = user_json.get("email")
        if not user_email:
            raise HTTPException(status_code=400, detail="Email not available in user info.")

        # Check if user exists in database
        session = next(get_db())
        user = crud.get_user_by_email(session=session, email=user_email)
        if not user:
            user = User(
                email=user_email,
                full_name=user_json.get("name", ""),
                is_active=True,
                google_id=user_json["sub"]
            )
            session.add(user)
            session.commit()
            session.refresh(user)

        # Generate JWT token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        jwt_token = security.create_access_token(subject=user.id, expires_delta=access_token_expires)

        # Check if the request is from a web browser - look for specific header
        user_agent = request.headers.get("user-agent", "").lower()
        
        # If this is a web browser
        if "mozilla" in user_agent:
            # For web browser, redirect directly to frontend with token
            frontend_url = "http://localhost:8081"
            
            print("Web browser detected in mobile endpoint, redirecting to frontend")
            print(f"User agent: {user_agent}")
            
            # Redirect directly to the tabs route in the frontend
            redirect_url = f"{frontend_url}/(tabs)?token={jwt_token}"
            print(f"Redirecting to: {redirect_url}")
            
            # Use 303 status to ensure a GET request is made to the redirect URL
            return RedirectResponse(url=redirect_url, status_code=303)
        else:
            # For mobile app, redirect with URL scheme
            # Make sure to use the right format that works with deep linking
            # The key point is to prefix with the app scheme and include the proper path
            # Make the URL more explicit for better debugging
            redirect_url = f"frontendrn://callback?access_token={jwt_token}"
            print(f"Redirecting to mobile app with URL: {redirect_url}")
            return RedirectResponse(url=redirect_url, status_code=302)

@router.get("/login/google/mobile")
async def login_google_mobile(request: Request):
    """
    Redirect users to Google for authentication (mobile version)
    """
    # For the mobile flow, we need to use a different redirect URI that the backend expects
    # This URI needs to match the one in your Google Cloud Console
    mobile_redirect_uri = f"{settings.BACKEND_HOST}{settings.API_V1_STR}/login/mobile/google/callback"
    
    # For debugging
    print(f"Using mobile redirect URI: {mobile_redirect_uri}")
    print(f"Original redirect URI from settings: {settings.GOOGLE_REDIRECT_URI}")
    print(f"Google client ID: {settings.GOOGLE_CLIENT_ID}")
    
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "response_type": "code",
        "scope": "openid email profile",
        "redirect_uri": mobile_redirect_uri,  # Use the mobile redirect URI
        "prompt": "select_account",
        "access_type": "offline",  # For refresh tokens
    }
    
    authorize_url = f"{settings.GOOGLE_AUTH_URL}?" + "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(authorize_url)