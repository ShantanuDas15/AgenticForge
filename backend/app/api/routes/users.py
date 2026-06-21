from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from cryptography.fernet import Fernet
from app.db.database import get_db
from app.api.dependencies import get_current_user
from app.schemas.users import UserSettingsUpdate, UserSettingsResponse
from app.models.user import User
from app.core.config import settings

router = APIRouter(dependencies=[Depends(get_current_user)])
cipher_suite = Fernet(settings.ENCRYPTION_KEY.encode())

@router.get("/settings", response_model=UserSettingsResponse)
def get_user_settings(current_user: User = Depends(get_current_user)):
    """
    Retrieves the user's current LLM provider settings (but not the raw API key).
    """
    return UserSettingsResponse(
        llm_provider=current_user.llm_provider,
        has_api_key=current_user.encrypted_api_key is not None,
        has_github_token=current_user.github_access_token is not None
    )

@router.put("/settings", response_model=UserSettingsResponse)
def update_user_settings(
    request: UserSettingsUpdate, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """
    Securely updates the LLM provider and encrypts the BYOK API key in the database.
    """
    current_user.llm_provider = request.llm_provider
    
    if request.api_key is not None:
        if request.api_key.strip() == "":
            current_user.encrypted_api_key = None
        else:
            current_user.encrypted_api_key = cipher_suite.encrypt(request.api_key.encode()).decode()
        
    db.commit()
    db.refresh(current_user)
    
    return UserSettingsResponse(
        llm_provider=current_user.llm_provider,
        has_api_key=current_user.encrypted_api_key is not None,
        has_github_token=current_user.github_access_token is not None
    )

from app.schemas.users import UpdatePasswordRequest, UpdateProfileRequest
from app.core.security import verify_password, get_password_hash

@router.put("/profile")
def update_user_profile(
    request: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update the authenticated user's profile details.
    """
    current_user.name = request.name
    db.commit()
    db.refresh(current_user)
    
    return {"message": "Profile updated successfully", "name": current_user.name}

@router.put("/password")
def update_password(
    request: UpdatePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Securely rotate the authenticated user's password.
    """
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )
        
    current_user.hashed_password = get_password_hash(request.new_password)
    db.commit()
    
    return {"message": "Password updated successfully"}

@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_account(
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """
    Permanently deletes the authenticated user's account and cascades to all related data.
    """
    from app.models.project import Project
    from app.models.usage import TokenUsage

    # Manually delete related data to ensure no foreign key constraint violations
    db.query(Project).filter(Project.user_id == current_user.id).delete()
    db.query(TokenUsage).filter(TokenUsage.user_id == current_user.id).delete()
    
    db.delete(current_user)
    db.commit()
    
    return None
