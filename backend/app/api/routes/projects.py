from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from sqlalchemy import func
from app.db.database import get_db
from app.models.project import Project
from app.models.usage import TokenUsage
from app.schemas.project import ProjectResponse
from app.api.dependencies import get_current_user

from app.models.user import User

router = APIRouter()

@router.get("/", response_model=List[ProjectResponse])
def get_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Retrieve a list of historical projects.
    Used by the frontend Dashboard for displaying past generations.
    """
    subquery = db.query(
        TokenUsage.thread_id,
        func.sum(TokenUsage.tokens).label('total_tokens')
    ).filter(TokenUsage.user_id == current_user.id).group_by(TokenUsage.thread_id).subquery()

    projects_with_tokens = db.query(
        Project,
        func.coalesce(subquery.c.total_tokens, 0).label('total_tokens')
    ).outerjoin(
        subquery, Project.thread_id == subquery.c.thread_id
    ).filter(
        Project.user_id == current_user.id
    ).order_by(Project.id.desc()).offset(skip).limit(limit).all()
    
    for p, t in projects_with_tokens:
        p.total_tokens = t
        
    return [p for p, t in projects_with_tokens]

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Retrieve the details of a single project by ID.
    """
    subquery = db.query(
        TokenUsage.thread_id,
        func.sum(TokenUsage.tokens).label('total_tokens')
    ).filter(TokenUsage.user_id == current_user.id).group_by(TokenUsage.thread_id).subquery()
    
    result = db.query(
        Project,
        func.coalesce(subquery.c.total_tokens, 0).label('total_tokens')
    ).outerjoin(
        subquery, Project.thread_id == subquery.c.thread_id
    ).filter(
        Project.id == project_id, Project.user_id == current_user.id
    ).first()
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
        
    project, total_tokens = result
    project.total_tokens = total_tokens
    return project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Delete a specific project from history.
    """
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    db.delete(project)
    db.commit()
    return None
