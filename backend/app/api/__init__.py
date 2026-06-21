from fastapi import APIRouter
from app.api.routes import health, llm_test, forge, projects, git, auth, deploy, usage, billing, users
from app.api.websockets import agent_stream

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(llm_test.router, tags=["llm-test"])
api_router.include_router(forge.router, prefix="/forge", tags=["forge"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(git.router, prefix="/git", tags=["git"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(deploy.router, prefix="/deploy", tags=["deploy"])
api_router.include_router(usage.router, prefix="/usage", tags=["usage"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(agent_stream.router, prefix="/ws/forge", tags=["websocket"])
