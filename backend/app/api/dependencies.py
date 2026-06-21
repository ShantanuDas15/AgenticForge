from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.database import get_db
from app.models.user import User

from app.core.exceptions import InvalidTokenError, AccountSuspendedError, ForbiddenError

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = InvalidTokenError()
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(User).filter(User.email == username).first()
    if user is None:
        raise credentials_exception
        
    if not user.is_active:
        raise AccountSuspendedError()
        
    return user

def require_tier(required_tier: str):
    def tier_checker(current_user: User = Depends(get_current_user)):
        if current_user.subscription_tier != required_tier:
            raise ForbiddenError(
                detail=f"This feature requires the {required_tier} subscription tier."
            )
        return current_user
    return tier_checker
