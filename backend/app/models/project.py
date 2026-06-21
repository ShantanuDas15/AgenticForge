from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False, server_default='1')
    thread_id = Column(String, index=True, nullable=True)
    user_prompt = Column(Text, nullable=False)
    final_plan = Column(Text, nullable=True)
    final_code = Column(Text, nullable=True)
    iterations_taken = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="projects")
