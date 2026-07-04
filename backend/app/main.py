from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api import api_router
from app.db.database import engine
from app.models import Base

import logging
from app.core.logging import setup_logging

# Initialize JSON logging for observability
setup_logging()
logger = logging.getLogger(__name__)

# Create all database tables in development (SQLite) only.
# In production, Alembic (start.sh) manages the schema exclusively.
# Calling create_all() in production would silently create tables without
# an alembic_version record, causing "DuplicateTable" errors on next deploy.
if settings.ENVIRONMENT != "production":
    Base.metadata.create_all(bind=engine)



from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from app.services.agents.workflow import compile_graph


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages the full application lifecycle using the modern FastAPI lifespan pattern.

    Startup sequence (environment-aware):
      PRODUCTION  → AsyncPostgresSaver on Supabase (durable, survives redeployments)
      DEVELOPMENT → AsyncSqliteSaver on local .db file (zero-config local dev)

    In both cases the compiled LangGraph graph is stored on the module-level
    `wf_module.graph` reference and is shared across all requests for the
    lifetime of the process.
    """
    if settings.ENVIRONMENT == "production" and settings.SUPABASE_DATABASE_URL:
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        # AsyncPostgresSaver uses psycopg3 which requires the plain "postgresql://" scheme.
        # SQLAlchemy-style dialect prefixes (e.g. "+psycopg2", "+asyncpg") must be stripped.
        _pg_url = (
            settings.SUPABASE_DATABASE_URL
            .replace("postgresql+psycopg2://", "postgresql://")
            .replace("postgresql+psycopg://",  "postgresql://")
            .replace("postgresql+asyncpg://",   "postgresql://")
        )
        async with AsyncPostgresSaver.from_conn_string(_pg_url) as checkpointer:
            await checkpointer.setup()  # Idempotent: creates checkpoint tables if absent
            compile_graph(checkpointer)
            logger.info(
                f"Starting {settings.PROJECT_NAME} in PRODUCTION mode. "
                f"Checkpointer: AsyncPostgresSaver (Supabase PostgreSQL)"
            )
            yield
            logger.info(f"Shutting down {settings.PROJECT_NAME}.")
    else:
        async with AsyncSqliteSaver.from_conn_string(
            settings.DATABASE_URL.replace("sqlite:///", "")
        ) as checkpointer:
            compile_graph(checkpointer)
            logger.info(
                f"Starting {settings.PROJECT_NAME} in {settings.ENVIRONMENT} mode. "
                f"Checkpointer: AsyncSqliteSaver ({settings.DATABASE_URL})"
            )
            yield
            logger.info(f"Shutting down {settings.PROJECT_NAME}.")



app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    error_code = getattr(exc, "error_code", "HTTP_ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error_code": error_code, "detail": exc.detail},
        headers=getattr(exc, "headers", None)
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error_code": "VALIDATION_ERROR",
            "detail": "Invalid request parameters",
            "errors": exc.errors()
        }
    )

# Set all CORS enabled origins
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)
