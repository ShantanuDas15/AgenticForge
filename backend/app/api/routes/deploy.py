from fastapi import APIRouter, Depends, HTTPException, status
import httpx
from app.schemas.deploy import DeployRequest, DeployResponse
from app.api.dependencies import get_current_user, require_tier
from app.core.config import settings

router = APIRouter(dependencies=[Depends(require_tier("pro_architect"))])

@router.post("/", response_model=DeployResponse)
async def deploy_to_cloud(request: DeployRequest):
    """
    Programmatically builds and deploys the AI-generated workspace files to Vercel or Netlify.
    """
    if request.provider == "vercel":
        if not settings.VERCEL_ACCESS_TOKEN:
            # Fallback for local demo purposes to keep frontend fully unblocked
            # if the user hasn't explicitly set a Vercel token in .env
            return DeployResponse(
                success=True,
                liveUrl=f"https://agenticforge-vercel-mock.vercel.app",
                message="Successfully deployed (Demo Mode - Missing API Token)",
                is_mock=True
            )
        
        vercel_files = [{"file": f.filename, "data": f.content} for f in request.files]
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    "https://api.vercel.com/v13/deployments",
                    headers={"Authorization": f"Bearer {settings.VERCEL_ACCESS_TOKEN}"},
                    json={
                        "name": "agentic-forge-deployment",
                        "files": vercel_files,
                        "projectSettings": {
                            "framework": None
                        }
                    }
                )
                response.raise_for_status()
                data = response.json()
                return DeployResponse(
                    success=True,
                    liveUrl=f"https://{data['url']}",
                    message="Successfully deployed to Vercel edge network."
                )
            except httpx.HTTPStatusError as e:
                raise HTTPException(status_code=500, detail=f"Vercel Deployment Failed: {e.response.text}")

    elif request.provider == "netlify":
        if not settings.NETLIFY_ACCESS_TOKEN:
            return DeployResponse(
                success=True,
                liveUrl=f"https://agenticforge-netlify-mock.netlify.app",
                message="Successfully deployed (Demo Mode - Missing API Token)",
                is_mock=True
            )
        
        import io
        import zipfile
        
        # Bundle files into an in-memory ZIP archive
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for f in request.files:
                zip_file.writestr(f.filename, f.content)
                
        zip_bytes = zip_buffer.getvalue()

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    "https://api.netlify.com/api/v1/sites",
                    headers={
                        "Authorization": f"Bearer {settings.NETLIFY_ACCESS_TOKEN}",
                        "Content-Type": "application/zip"
                    },
                    content=zip_bytes
                )
                response.raise_for_status()
                data = response.json()
                return DeployResponse(
                    success=True,
                    liveUrl=data.get("url", ""),
                    message="Successfully deployed to Netlify."
                )
            except httpx.HTTPStatusError as e:
                raise HTTPException(status_code=500, detail=f"Netlify Deployment Failed: {e.response.text}")
        
    else:
        raise HTTPException(status_code=400, detail="Invalid cloud provider specified.")
