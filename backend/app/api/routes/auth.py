from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import UserCreate, UserLogin, Token, RefreshTokenRequest
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token

from app.core.exceptions import DuplicateUserError, InvalidCredentialsError, NotFoundError, ValidationError

router = APIRouter()

@router.post("/register", response_model=Token)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise DuplicateUserError()
    user = User(
        email=user_in.email,
        name=user_in.name,
        hashed_password=get_password_hash(user_in.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})
    return {
        "access_token": access_token, 
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/login", response_model=Token)
def login_user(user_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_in.email).first()
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise InvalidCredentialsError()

    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})
    return {
        "access_token": access_token, 
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user
    }

from app.schemas.auth import ForgotPasswordRequest, ResetPasswordRequest
import uuid

from datetime import datetime, timedelta, timezone

from app.services.email import send_password_reset_email

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        # Return success anyway to prevent email enumeration
        return {"message": "If that email is registered, a password reset link has been sent."}
    
    reset_token = str(uuid.uuid4())
    
    user.reset_token = reset_token
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    db.commit()
    
    # Dispatch real email asynchronously
    await send_password_reset_email(user.email, reset_token)
    
    return {"message": "If that email is registered, a password reset link has been sent."}

@router.post("/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    if not request.token:
        raise ValidationError("Invalid token")
        
    user = db.query(User).filter(
        User.reset_token == request.token,
        User.reset_token_expires > datetime.now(timezone.utc)
    ).first()
    
    if not user:
        raise ValidationError("Invalid or expired reset token")
        
    user.hashed_password = get_password_hash(request.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    
    return {"message": "Password has been successfully reset."}

from jose import jwt, JWTError
from app.core.config import settings

@router.post("/refresh", response_model=Token)
def refresh_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(request.refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise ValidationError("Invalid refresh token format")
        
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise ValidationError("User not found")
            
        new_access_token = create_access_token(data={"sub": user.email})
        new_refresh_token = create_refresh_token(data={"sub": user.email})
        
        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "user": user
        }
    except JWTError:
        raise ValidationError("Invalid or expired refresh token")

# ─── Google OAuth 2.0 ──────────────────────────────────────────────────────

import httpx
import json as _json
from urllib.parse import urlencode
from fastapi.responses import RedirectResponse as _Redirect

_GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_INFO_URL  = "https://www.googleapis.com/oauth2/v3/userinfo"


@router.get("/google/login")
def google_login():
    """Redirect the browser to Google's OAuth consent screen."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    return _Redirect(f"{_GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/google/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    """Exchange auth code → upsert user → redirect to frontend with JWT."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")

    # 1. Exchange authorization code for Google tokens
    async with httpx.AsyncClient() as client:
        token_res = await client.post(_GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
    if token_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to exchange Google auth code")
    google_access_token = token_res.json()["access_token"]

    # 2. Fetch Google user profile
    async with httpx.AsyncClient() as client:
        info_res = await client.get(
            _GOOGLE_INFO_URL,
            headers={"Authorization": f"Bearer {google_access_token}"},
        )
    if info_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch Google user profile")
    profile = info_res.json()

    email     = profile["email"]
    name      = profile.get("name", email.split("@")[0])
    google_id = profile["sub"]  # stable, opaque Google user ID

    # 3. Upsert: google_id → email match → new user
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, name=name, google_id=google_id, hashed_password=None)
        db.add(user)
    elif not user.google_id:
        user.google_id = google_id  # link Google to existing password account
    db.commit()
    db.refresh(user)

    # 4. Issue our own JWT tokens (identical shape to /auth/login response)
    access_token  = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})

    # 5. Redirect to frontend callback page with tokens in query string
    user_data = {
        "id": user.id, "email": user.email, "name": user.name,
        "subscription_tier": user.subscription_tier, "is_active": user.is_active,
    }
    qs = urlencode({
        "access_token":  access_token,
        "refresh_token": refresh_token,
        "user":          _json.dumps(user_data),
    })
    return _Redirect(f"{settings.FRONTEND_URL}/auth/callback?{qs}")
