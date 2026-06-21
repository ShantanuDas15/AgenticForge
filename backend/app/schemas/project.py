from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class ProjectBase(BaseModel):
    user_prompt: str
    final_plan: Optional[str] = None
    final_code: Optional[str] = None
    iterations_taken: int = 0

class ProjectCreate(ProjectBase):
    pass

class ProjectResponse(ProjectBase):
    id: int
    user_id: int
    thread_id: str
    created_at: datetime
    total_tokens: Optional[int] = 0
    
    model_config = ConfigDict(from_attributes=True)
