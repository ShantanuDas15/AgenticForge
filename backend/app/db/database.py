from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Determine connection logic based on environment
if settings.ENVIRONMENT == "production" and settings.SUPABASE_DATABASE_URL:
    db_url = settings.SUPABASE_DATABASE_URL
    connect_args = {} # Postgres doesn't require check_same_thread
else:
    db_url = settings.DATABASE_URL
    connect_args = {"check_same_thread": False} # SQLite requirement

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
