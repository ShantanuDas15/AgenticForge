from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Determine connection logic based on environment
if settings.ENVIRONMENT == "production" and settings.SUPABASE_DATABASE_URL:
    # Normalize to psycopg3 SQLAlchemy dialect (+psycopg).
    # Supabase gives postgresql+psycopg2:// URLs but we only install psycopg[binary,pool]
    # (psycopg v3). SQLAlchemy uses +psycopg as the dialect name for v3.
    db_url = (
        settings.SUPABASE_DATABASE_URL
        .replace("postgresql+psycopg2://", "postgresql+psycopg://")
        .replace("postgres+psycopg2://",   "postgresql+psycopg://")
    )
    connect_args = {}
else:
    db_url = settings.DATABASE_URL
    connect_args = {"check_same_thread": False}  # SQLite requirement

engine = create_engine(
    db_url, connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
