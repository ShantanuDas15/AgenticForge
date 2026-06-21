from pydantic import BaseModel, Field
from typing import List

class GitFile(BaseModel):
    filename: str
    content: str

class GitCommitRequest(BaseModel):
    repoName: str = Field(..., description="The name of the GitHub repository to commit to (e.g. 'owner/repo')")
    commitMessage: str = Field(..., description="The commit message")
    files: List[GitFile] = Field(..., description="List of files to commit")
    threadId: str = Field(None, description="Optional thread ID associated with the workspace")

class GitCommitResponse(BaseModel):
    success: bool
    message: str
    commit_url: str = Field(None, description="URL to the newly created commit on GitHub")
