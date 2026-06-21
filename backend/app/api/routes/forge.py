from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.schemas.agent import ForgeRequest, ForgeResponse, ResumeRequest, ThreadHistoryResponse
from app.schemas.streaming import StreamEvent
import app.services.agents.workflow as wf_module
from langchain_core.messages import HumanMessage
from app.db.database import get_db
from app.models.project import Project
from app.api.dependencies import get_current_user
from app.core.exceptions import GenerationError

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.post("/generate", response_model=ForgeResponse)
async def generate_code(request: ForgeRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Executes the multi-agent LangGraph workflow to generate code based on a prompt.
    """
    try:
        import uuid
        thread_id = str(request.thread_id) if request.thread_id else str(uuid.uuid4())
        config = {"configurable": {"thread_id": thread_id}}
        
        # Initialize state with the user prompt
        initial_state = {
            "messages": [HumanMessage(content=request.prompt)],
        }
        
        # Invoke the compiled LangGraph workflow asynchronously
        final_state = await wf_module.graph.ainvoke(initial_state, config=config)
        
        plan = final_state.get("current_plan", "")
        code = final_state.get("current_code", "")
        workspace_files = final_state.get("workspace_files", [])
        iterations = final_state.get("iteration_count", 0)
        
        # Save to database
        db_project = Project(
            user_id=current_user.id,
            thread_id=thread_id,
            user_prompt=request.prompt,
            final_plan=plan,
            final_code=code,
            iterations_taken=iterations
        )
        db.add(db_project)
        db.commit()
        db.refresh(db_project)
        
        # Extract the results from the final state
        return ForgeResponse(
            plan=plan,
            code=code,
            workspace_files=workspace_files,
            iterations=iterations
        )
    except Exception as e:
        raise GenerationError(detail=f"Code generation failed: {str(e)}")


@router.post("/resume", response_model=ForgeResponse)
async def resume_workflow(request: ResumeRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Resumes a LangGraph workflow that was paused at the Human-in-the-Loop breakpoint
    (interrupt_before=["reviewer"]). Optionally injects human feedback into the state
    before the reviewer node runs.

    Flow:
      1. Verify the thread exists and is actually paused at 'reviewer'.
      2. If human_feedback is provided, update the state to inject it as a HumanMessage.
      3. Re-invoke the graph with None as input (LangGraph resumes from the checkpoint).
      4. Return the final ForgeResponse once the graph reaches END.
    """
    thread_id = str(request.thread_id)
    config = {"configurable": {"thread_id": thread_id}}

    try:
        # 1. Verify the thread is in a paused HITL state
        snapshot = wf_module.graph.get_state(config)
        if not snapshot or snapshot.next != ("reviewer",):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Thread '{thread_id}' is not currently paused at a review breakpoint. "
                    "Ensure the workflow has reached the HITL interrupt before calling /resume."
                )
            )

        # 2. Optionally inject human feedback into the thread state
        if request.human_feedback:
            wf_module.graph.update_state(
                config,
                {"messages": [HumanMessage(content=request.human_feedback)]}
            )

        # 3. Resume by invoking with None — LangGraph picks up from the last checkpoint
        final_state = await wf_module.graph.ainvoke(None, config=config)

        plan = final_state.get("current_plan", "")
        code = final_state.get("current_code", "")
        workspace_files = final_state.get("workspace_files", [])
        iterations = final_state.get("iteration_count", 0)

        # 4. Persist the completed result to the database
        db_project = Project(
            user_id=current_user.id,
            thread_id=thread_id,
            user_prompt=f"[RESUMED] thread={thread_id}",
            final_plan=plan,
            final_code=code,
            iterations_taken=iterations
        )
        db.add(db_project)
        db.commit()
        db.refresh(db_project)

        return ForgeResponse(plan=plan, code=code, workspace_files=workspace_files, iterations=iterations)

    except HTTPException:
        raise
    except Exception as e:
        raise GenerationError(detail=f"Resume failed: {str(e)}")


@router.get("/threads/{thread_id}/history", response_model=ThreadHistoryResponse)
async def get_thread_history(thread_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Returns the historical state snapshots for a given thread to allow the 
    frontend to display the conversation and code iteration history.
    """
    import uuid
    try:
        parsed_id = uuid.UUID(thread_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid thread_id format")

    # Enforce multi-tenant isolation by checking ownership
    project = db.query(Project).filter(Project.thread_id == thread_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=403, detail="Not authorized to access this thread or thread does not exist.")

    config = {"configurable": {"thread_id": thread_id}}
    
    try:
        events = []
        # aget_state_history returns snapshots in reverse chronological order (newest first)
        async for snapshot in wf_module.graph.aget_state_history(config):
            values = snapshot.values
            next_nodes = snapshot.next
            
            state_dict = {
                "current_plan": values.get("current_plan", ""),
                "current_code": values.get("current_code", ""),
                "workspace_files": values.get("workspace_files", []),
            }
            
            # Determine if the snapshot is paused at the human-in-the-loop review node
            if next_nodes and "reviewer" in next_nodes:
                events.append(StreamEvent(
                    type="interrupted",
                    node="system",
                    message="Workflow paused for human-in-the-loop review.",
                    state=state_dict
                ))
            else:
                events.append(StreamEvent(
                    type="node_finish",
                    node="coder",
                    message="Loaded historical state snapshot.",
                    state=state_dict
                ))
            
        # The frontend expects chronological order (oldest to newest)
        return ThreadHistoryResponse(
            thread_id=uuid.UUID(thread_id),
            history=list(reversed(events))
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch thread history: {str(e)}")

