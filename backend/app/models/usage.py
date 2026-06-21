from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date
from sqlalchemy.sql import func
from app.models import Base
from datetime import date

class TokenUsage(Base):
    __tablename__ = "token_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    thread_id = Column(String, index=True, nullable=True)
    tokens = Column(Integer, nullable=False, default=0)
    date = Column(Date, default=date.today, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
