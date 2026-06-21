from typing import AsyncGenerator
from langgraph.graph import StateGraph, START, END
from app.services.agents.state import AgentState
from app.services.agents.nodes.planner import planner_node
from app.services.agents.nodes.coder import coder_node
from app.services.agents.nodes.reviewer import reviewer_node
from app.schemas.streaming import StreamEvent


def review_routing(state: AgentState) -> str:
    """
    Conditional routing logic after the reviewer node.
    """
    # Circuit breaker: prevent infinite loops and high API costs
    if state.get("iteration_count", 0) > 3:
        return END

    # Check if the reviewer approved the code
    if state.get("reviewer_feedback") == "APPROVED":
        return END

    # If not approved and under limit, route back to the coder node to fix issues
    return "coder"


# ---------------------------------------------------------------------------
# Graph Topology (module-level, stateless)
# Defines nodes and edges only — does NOT compile with a checkpointer here.
# Compilation is deferred to lifespan() in main.py so the async SQLite
# checkpointer can be properly awaited before the first request arrives.
# ---------------------------------------------------------------------------

_workflow = StateGraph(AgentState)

# Add nodes
_workflow.add_node("planner", planner_node)
_workflow.add_node("coder", coder_node)
_workflow.add_node("reviewer", reviewer_node)

# Add static edges
_workflow.add_edge(START, "planner")
_workflow.add_edge("planner", "coder")
_workflow.add_edge("coder", "reviewer")

# Add conditional edge from reviewer
_workflow.add_conditional_edges(
    "reviewer",
    review_routing,
    {
        "coder": "coder",
        END: END,
    },
)

# ---------------------------------------------------------------------------
# Runtime graph handle
# This is set once by lifespan() at startup after the SQLite checkpointer is
# initialised.  All routes and the streaming helper read this reference.
# ---------------------------------------------------------------------------
graph = None  # type: ignore[assignment]


def compile_graph(checkpointer) -> None:
    """
    Compile the workflow with the provided checkpointer and store the result
    in the module-level `graph` reference.

    Called exactly once from the FastAPI lifespan context manager after the
    async SQLite connection is established.

    interrupt_before=["reviewer"] retains the HITL pause point from Phase 6:
    the graph halts after the Coder drafts code so a human can optionally
    inject feedback via POST /api/v1/forge/resume before the reviewer runs.
    """
    global graph
    graph = _workflow.compile(
        checkpointer=checkpointer,
        interrupt_before=["reviewer"],
    )


async def run_agent_stream(
    initial_state: "dict | None",
    thread_id: str,
    llm_provider: str = "groq",
    api_key: str = None
) -> AsyncGenerator[StreamEvent, None]:
    """
    Executes the LangGraph workflow in streaming mode (Phase 3, 4 & 7).
    Instead of blocking until the entire graph finishes, it yields StreamEvent
    schemas as each node completes, enabling real-time UI updates.

    Supports two modes via `initial_state`:

      initial_state = dict   — **New generation**
        Normal first-run: state is seeded with the user's HumanMessage.

      initial_state = None   — **HITL Resume** (Phase 7 Step 3.6)
        LangGraph reads the existing checkpoint for `thread_id` and continues
        from where it was interrupted.  No state injection needed — the caller
        is responsible for injecting feedback via graph.update_state() before
        calling this function.

    HITL Interrupt Detection:
    When interrupt_before=["reviewer"] fires, graph.astream() stops yielding
    naturally. We detect this by inspecting graph.get_state(config) after
    streaming ends — if next == ('reviewer',) the graph is paused again
    (e.g. another coder iteration). We emit 'interrupted' so the frontend
    can prompt the user again. If the graph reaches END, we emit 'complete'.
    """
    is_resume = initial_state is None
    opening_msg = (
        "Resuming AgenticForge workflow from checkpoint..."
        if is_resume
        else "Initializing AgenticForge workflow..."
    )
    yield StreamEvent(type="node_start", node="system", message=opening_msg)

    config = {
        "configurable": {
            "thread_id": thread_id,
            "llm_provider": llm_provider,
            "api_key": api_key
        }
    }

    try:
        # stream_mode="updates" yields only the state diff returned by the node that just executed
        async for output in graph.astream(initial_state, config=config, stream_mode="updates"):
            for node_name, state_update in output.items():
                # Extract serializable state (ignore LangChain BaseMessages for the frontend stream)
                safe_state = {
                    key: value
                    for key, value in state_update.items()
                    if key != "messages"
                }
                
                # Extract token usage
                messages = state_update.get("messages", [])
                if messages and hasattr(messages[-1], "response_metadata"):
                    usage = messages[-1].response_metadata.get("token_usage", {})
                    # Groq vs OpenAI format handling
                    tokens = usage.get("total_tokens") or usage.get("total_time") or 0
                    if tokens:
                        safe_state["tokens_consumed"] = int(tokens * 1000) if "time" in str(usage) else int(tokens)

                # Bridge the sandbox output gap by streaming stdout/stderr BEFORE node_finish
                if node_name == "coder" and "sandbox_result" in safe_state:
                    yield StreamEvent(
                        type="sandbox_output",
                        node="sandbox",
                        message=safe_state["sandbox_result"]
                    )

                yield StreamEvent(
                    type="node_finish",
                    node=node_name,
                    state=safe_state,
                    message=f"Agent '{node_name}' completed its execution."
                )

        # --- HITL Interrupt Detection ---
        # After streaming ends, check whether the graph paused at the reviewer breakpoint.
        snapshot = graph.get_state(config)
        if snapshot.next == ("reviewer",):
            # Graph is paused — surface the draft code so the frontend can prompt the user.
            draft_code = snapshot.values.get("current_code", "")
            draft_plan = snapshot.values.get("current_plan", "")
            yield StreamEvent(
                type="interrupted",
                node="reviewer",
                state={"current_code": draft_code, "current_plan": draft_plan},
                message=(
                    "Workflow paused before automated review. "
                    "Inspect the draft code and call POST /api/forge/resume with your "
                    f"thread_id and optional human_feedback to continue."
                )
            )
        else:
            yield StreamEvent(type="complete", node="system", message="Workflow execution finished successfully.")

    except Exception as e:
        yield StreamEvent(type="error", node="system", message=f"An error occurred during execution: {str(e)}")
