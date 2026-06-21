import json
import uuid as uuid_module
from cryptography.fernet import Fernet
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
from langchain_core.messages import HumanMessage

from app.api.websockets.connection_manager import manager
from app.db.database import get_db
from app.models.project import Project
from app.models.usage import TokenUsage
from app.models.user import User
from app.core.config import settings
from app.services.agents.workflow import run_agent_stream
import app.services.agents.workflow as wf_module
import asyncio

async def listen_for_messages(websocket: WebSocket):
    """Background task to listen for pings and handle client disconnects"""
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                if payload.get("type") == "ping":
                    await manager.send_personal_message({"type": "pong"}, websocket)
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        pass
    except Exception:
        pass

router = APIRouter()
cipher_suite = Fernet(settings.ENCRYPTION_KEY.encode())


@router.websocket("/stream")
async def websocket_endpoint(
    websocket: WebSocket, 
    token: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for real-time streaming of the LangGraph execution.
    Expects a JSON payload with a 'prompt' string to initialize the graph.
    """
    if not token:
        await websocket.close(code=1008, reason="Authentication token is required")
        return
        
    try:
        from app.api.dependencies import get_current_user
        user = get_current_user(token=token, db=db)
    except Exception:
        await websocket.close(code=1008, reason="Invalid authentication token")
        return

    await manager.connect(websocket)
    try:
        # 1. Client connects and sends a JSON payload containing the prompt.
        data = await websocket.receive_text()
        payload = json.loads(data)
        prompt = payload.get("prompt", "")

        if not prompt:
            await manager.send_personal_message({"type": "error", "message": "Prompt is required"}, websocket)
            manager.disconnect(websocket)
            return

        # Initialize the state for the LangGraph with just the new message
        initial_state = {
            "messages": [HumanMessage(content=prompt)],
        }

        final_state_data = {}
        total_tokens = 0

        thread_id = payload.get("thread_id", str(uuid_module.uuid4()))

        # Securely fetch the API key from the database using the authenticated user
        llm_provider = user.llm_provider if user else payload.get("llm_provider", "groq")
        api_key = None
        if user and user.encrypted_api_key:
            api_key = cipher_suite.decrypt(user.encrypted_api_key.encode()).decode()

        # Start listening for heartbeat pings in the background
        listener_task = asyncio.create_task(listen_for_messages(websocket))

        try:
            # 2. The backend initiates the graph.astream() via the wrapper.
            # 3. As each node yields, format into StreamEvent and send over WebSocket.
            async for event in run_agent_stream(
                initial_state, 
                thread_id=thread_id, 
                llm_provider=llm_provider, 
                api_key=api_key
            ):
                # Send the typed StreamEvent model dumped as a dict
                await manager.send_personal_message(event.model_dump(), websocket)

                # Keep track of the latest state to save to the DB at the end
                if event.state:
                    final_state_data.update(event.state)
                    if "tokens_consumed" in event.state:
                        total_tokens += event.state["tokens_consumed"]
        finally:
            listener_task.cancel()

        # 4. Once the graph hits END, save the final code to the SQLite database
        if final_state_data:
            project = Project(
                user_id=user.id,
                thread_id=thread_id,
                user_prompt=prompt,
                final_plan=final_state_data.get("current_plan", ""),
                final_code=final_state_data.get("current_code", ""),
                iterations_taken=final_state_data.get("iteration_count", 0)
            )
            db.add(project)
            
            if total_tokens > 0:
                usage = TokenUsage(user_id=user.id, thread_id=thread_id, tokens=total_tokens)
                db.add(usage)
                
            db.commit()
            db.refresh(project)

        manager.disconnect(websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        await manager.send_personal_message({"type": "error", "message": f"Server Error: {str(e)}"}, websocket)
        manager.disconnect(websocket)


@router.websocket("/resume")
async def websocket_resume_endpoint(
    websocket: WebSocket, 
    token: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for streaming the resumed execution of a paused HITL workflow.

    Provides the same real-time node_finish event stream as /ws/forge/stream but
    for a workflow that was previously paused at interrupt_before=["reviewer"].

    Expected JSON payload:
        {
            "thread_id": "<uuid>",            # required — the paused thread
            "human_feedback": "<string>"      # optional — injected before reviewer runs
        }

    Event sequence emitted:
        node_start   → "Resuming AgenticForge workflow from checkpoint..."
        node_finish  → for each node that executes after resume (reviewer, coder if
                        rejected, reviewer again, …)
        interrupted  → if the graph pauses at the reviewer breakpoint again
        complete     → if the graph reaches END
        error        → on any exception

    The REST POST /resume endpoint remains available as a blocking fallback for
    clients that cannot maintain a WebSocket connection.
    """
    if not token:
        await websocket.close(code=1008, reason="Authentication token is required")
        return
        
    try:
        from app.api.dependencies import get_current_user
        user = get_current_user(token=token, db=db)
    except Exception:
        await websocket.close(code=1008, reason="Invalid authentication token")
        return

    await manager.connect(websocket)
    try:
        data = await websocket.receive_text()
        payload = json.loads(data)
        thread_id = payload.get("thread_id", "")

        if not thread_id:
            await manager.send_personal_message(
                {"type": "error", "message": "thread_id is required to resume a workflow"},
                websocket,
            )
            manager.disconnect(websocket)
            return

        config = {"configurable": {"thread_id": thread_id}}

        # --- Pre-flight: verify the thread is actually paused at the reviewer ---
        snapshot = wf_module.graph.get_state(config)
        if not snapshot or snapshot.next != ("reviewer",):
            await manager.send_personal_message(
                {
                    "type": "error",
                    "message": (
                        f"Thread '{thread_id}' is not currently paused at a review breakpoint. "
                        "Ensure the workflow has reached the HITL interrupt before calling /resume."
                    ),
                },
                websocket,
            )
            manager.disconnect(websocket)
            return

        # --- Optionally inject human feedback before resuming ---
        human_feedback = payload.get("human_feedback")
        if human_feedback:
            wf_module.graph.update_state(
                config,
                {"messages": [HumanMessage(content=human_feedback)]},
            )

        # --- Stream the resumed execution (initial_state=None → resume from checkpoint) ---
        final_state_data = {}
        total_tokens = 0
        llm_provider = user.llm_provider if user else payload.get("llm_provider", "groq")
        api_key = None
        if user and user.encrypted_api_key:
            api_key = cipher_suite.decrypt(user.encrypted_api_key.encode()).decode()
        
        listener_task = asyncio.create_task(listen_for_messages(websocket))
        
        try:
            async for event in run_agent_stream(
                None, 
                thread_id=thread_id,
                llm_provider=llm_provider,
                api_key=api_key
            ):
                await manager.send_personal_message(event.model_dump(), websocket)
                if event.state:
                    final_state_data.update(event.state)
                    if "tokens_consumed" in event.state:
                        total_tokens += event.state["tokens_consumed"]
        finally:
            listener_task.cancel()

        # --- Persist the resumed result if the graph reached END ---
        if final_state_data.get("current_code"):
            project = Project(
                user_id=user.id,
                thread_id=thread_id,
                user_prompt=f"[RESUMED] thread={thread_id}",
                final_plan=final_state_data.get("current_plan", ""),
                final_code=final_state_data.get("current_code", ""),
                iterations_taken=final_state_data.get("iteration_count", 0),
            )
            db.add(project)
            
            if total_tokens > 0:
                usage = TokenUsage(user_id=user.id, thread_id=thread_id, tokens=total_tokens)
                db.add(usage)
                
            db.commit()
            db.refresh(project)

        manager.disconnect(websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        await manager.send_personal_message(
            {"type": "error", "message": f"Server Error: {str(e)}"},
            websocket,
        )
        manager.disconnect(websocket)

