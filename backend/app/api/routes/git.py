from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import httpx
import os
from github import Github, InputGitTreeElement
from app.schemas.git import GitCommitRequest, GitCommitResponse
from app.api.dependencies import get_current_user, require_tier
from app.db.database import get_db
from app.models.user import User
from app.core.config import settings

router = APIRouter()

@router.post("/commit", response_model=GitCommitResponse, dependencies=[Depends(require_tier("pro_architect"))])
async def commit_to_github(request: GitCommitRequest):
    """
    Commits generated code to a GitHub repository using PyGithub.
    """
    if not settings.GITHUB_ACCESS_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GITHUB_ACCESS_TOKEN is not configured on the server."
        )

    try:
        g = Github(settings.GITHUB_ACCESS_TOKEN)
        repo = g.get_repo(request.repoName)

        # Get the default branch (usually 'main' or 'master')
        default_branch = repo.default_branch
        ref = repo.get_git_ref(f"heads/{default_branch}")
        
        # Get the current commit and tree
        base_commit = repo.get_git_commit(ref.object.sha)
        base_tree = repo.get_git_tree(base_commit.tree.sha)

        # Create elements for the new tree
        tree_elements = []
        for file in request.files:
            blob = repo.create_git_blob(file.content, "utf-8")
            element = InputGitTreeElement(
                path=file.filename,
                mode="100644",
                type="blob",
                sha=blob.sha
            )
            tree_elements.append(element)

        # Create a new tree
        new_tree = repo.create_git_tree(tree_elements, base_tree)

        # Create a new commit
        new_commit = repo.create_git_commit(
            message=request.commitMessage,
            tree=new_tree,
            parents=[base_commit]
        )

        # Update the reference
        ref.edit(new_commit.sha)

        return GitCommitResponse(
            success=True,
            message=f"Successfully committed to {request.repoName}",
            commit_url=f"https://github.com/{request.repoName}/commit/{new_commit.sha}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to commit to GitHub: {str(e)}"
        )

@router.get("/github/login", dependencies=[Depends(require_tier("pro_architect"))])
def github_login(current_user: User = Depends(get_current_user)):
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_REDIRECT_URI:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="GitHub OAuth is not configured on this server."
        )
        
    client_id = settings.GITHUB_CLIENT_ID
    state = current_user.email
    redirect_uri = settings.GITHUB_REDIRECT_URI
    url = f"https://github.com/login/oauth/authorize?client_id={client_id}&redirect_uri={redirect_uri}&scope=repo&state={state}"
    return {"url": url}

@router.get("/github/callback")
async def github_callback(code: str, state: str, db: Session = Depends(get_db)):
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/settings?github=error_not_configured")

    client_id = settings.GITHUB_CLIENT_ID
    client_secret = settings.GITHUB_CLIENT_SECRET
    frontend_url = settings.FRONTEND_URL
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code
            }
        )
        data = response.json()
        access_token = data.get("access_token")
        
        if access_token:
            user = db.query(User).filter(User.email == state).first()
            if user:
                user.github_access_token = access_token
                db.commit()
                return RedirectResponse(url=f"{frontend_url}/settings?github=success")
                
    return RedirectResponse(url=f"{frontend_url}/settings?github=error")
