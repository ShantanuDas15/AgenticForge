from typing import List, Optional
from pydantic import ConfigDict, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env")

    PROJECT_NAME: str = "AgenticForge"
    API_V1_STR: str = "/api/v1"
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    ENVIRONMENT: str = "development"  # 'development' or 'production'
    
    # Auth Configuration
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ENCRYPTION_KEY: str

    @field_validator("SECRET_KEY", "ENCRYPTION_KEY")
    @classmethod
    def secret_key_must_be_set(cls, v: str) -> str:
        if not v or v == "changeme":
            raise ValueError("Security keys must be explicitly set in environment")
        return v
    
    # Git / Source Control
    GITHUB_ACCESS_TOKEN: Optional[str] = None
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    GITHUB_REDIRECT_URI: Optional[str] = None
    
    # Cloud Deployment
    FRONTEND_URL: str = "http://localhost:5173"
    VERCEL_ACCESS_TOKEN: Optional[str] = None
    NETLIFY_ACCESS_TOKEN: Optional[str] = None

    # Database Configuration
    DATABASE_URL: str = "sqlite:///./agentic_forge.db"
    SUPABASE_DATABASE_URL: Optional[str] = None

    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost",
        "http://localhost:5173",  # Vite frontend
    ]


settings = Settings()
