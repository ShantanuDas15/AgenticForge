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

# Create all database tables (fallback for SQLite development)
Base.metadata.create_all(bind=engine)


from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from app.services.agents.workflow import compile_graph


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages the full application lifecycle using the modern FastAPI lifespan pattern.
    Code before `yield` runs on startup; code after `yield` runs on shutdown.

    Startup sequence:
      1. Open the async SQLite connection for the LangGraph checkpointer.
         This replaces the in-process MemorySaver — checkpoints now survive
         process restarts, container redeployments, and uvicorn reloads.
      2. Compile the LangGraph workflow with the durable checkpointer.
      3. Log the startup confirmation.

    The `async with` block keeps the aiosqlite connection alive for the full
    application lifetime and closes it cleanly on shutdown.
    """
    async with AsyncSqliteSaver.from_conn_string(settings.DATABASE_URL.replace("sqlite:///", "")) as checkpointer:
        compile_graph(checkpointer)
        logger.info(
            f"Starting {settings.PROJECT_NAME} in {settings.ENVIRONMENT} mode. "
            f"Checkpointer: AsyncSqliteSaver ({settings.DATABASE_URL})"
        )
        yield
        # --- Shutdown: aiosqlite connection closed automatically by context manager ---
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
