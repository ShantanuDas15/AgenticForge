from fastapi import APIRouter, HTTPException, Depends
from cryptography.fernet import Fernet
from app.services.llm.factory import test_llm_connection
from app.api.dependencies import get_current_user
from app.models.user import User
from app.core.config import settings

router = APIRouter(dependencies=[Depends(get_current_user)])
cipher_suite = Fernet(settings.ENCRYPTION_KEY.encode())

from pydantic import BaseModel

class LLMTestRequest(BaseModel):
    prompt: str = "Say 'Hello, AgenticForge is alive!'"
    provider: str | None = None
    api_key: str | None = None

@router.post("/llm-test")
def llm_test_endpoint(
    request: LLMTestRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Test endpoint for verifying LLM connectivity with BYOK before saving.
    """
    try:
        provider = request.provider or current_user.llm_provider
        api_key = request.api_key
        
        # Fallback to saved DB key if user passed the placeholder mask
        if (not api_key or api_key == '••••••••••••••••') and current_user.encrypted_api_key:
            api_key = cipher_suite.decrypt(current_user.encrypted_api_key.encode()).decode()
            
        response = test_llm_connection(
            prompt=request.prompt,
            provider=provider,
            api_key=api_key
        )
        return {"status": "success", "response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
