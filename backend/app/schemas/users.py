from pydantic import BaseModel, Field
from typing import Optional

class UserSettingsUpdate(BaseModel):
    llm_provider: str
    api_key: Optional[str] = None

class UserSettingsResponse(BaseModel):
    llm_provider: str
    has_api_key: bool
    has_github_token: bool

class UpdatePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)

class UpdateProfileRequest(BaseModel):
    name: str
