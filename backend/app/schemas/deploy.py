from pydantic import BaseModel, Field
from typing import List

class DeployFile(BaseModel):
    filename: str
    content: str

class DeployRequest(BaseModel):
    provider: str = Field(..., description="The cloud provider ('vercel' or 'netlify')")
    files: List[DeployFile] = Field(..., description="List of files to deploy")
    
class DeployResponse(BaseModel):
    success: bool
    liveUrl: str = Field(None, description="The live edge URL of the deployed application")
    message: str = Field(None, description="Detailed deployment status message")
    is_mock: bool = Field(False, description="Indicates if this is a mock deployment")
