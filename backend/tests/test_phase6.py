"""
=============================================================================
AgenticForge · Phase 6 End-to-End Test Suite
Senior Principal Generative AI Engineer & System Architect
=============================================================================

Covers all four steps of the Phase 6 development plan:

  Step 3.1 — Expanding Agent State & Pydantic Schemas
    • AgentState uses Annotated[list[AnyMessage], add_messages] reducer
    • add_messages appends rather than overwrites
    • ForgeRequest accepts optional thread_id (UUID)
    • ResumeRequest schema is well-formed and validated

  Step 3.2 — Context-Aware Workflow Nodes
    • planner_node passes full state["messages"] to the LLM
    • coder_node passes full state["messages"] to the LLM
    • Both nodes use SystemMessage, not a raw HumanMessage wrapper

  Step 3.3 — Stateful Endpoint Modifications
    • POST /generate generates a fresh thread_id when none is supplied
    • POST /generate passes caller-supplied thread_id through to graph.ainvoke
    • Only the new HumanMessage is placed in initial_state (no state reset)
    • DB persistence is correct in both new and continuation scenarios

  Step 3.4 — Human-in-the-Loop Foundation
    • Graph is compiled with interrupt_before=["reviewer"]
    • run_agent_stream emits "interrupted" event when graph is paused
    • run_agent_stream emits "complete" when graph finishes normally
    • POST /resume returns 400 for a thread not at a breakpoint
    • POST /resume injects human_feedback and resumes correctly
    • POST /resume omits feedback injection when human_feedback is None
    • POST /resume persists the resumed result to the database

Strategy
--------
All Groq / LLM calls are mocked with unittest.mock so no network access or
API key is required.  The LangGraph graph object is mocked at the endpoint
level so we never exercise the full LangGraph runtime in automated tests
(that is covered by the separate live e2e scripts).  Each test is
self-contained and uses an isolated in-memory SQLite database.
"""

import uuid
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

from app.main import app
from app.models.project import Project
from app.schemas.agent import ForgeRequest, ResumeRequest, ForgeResponse
from app.schemas.streaming import StreamEvent
from app.services.agents.state import AgentState

# ---------------------------------------------------------------------------
# DB engine, session, and get_db override are provided by tests/conftest.py.
# Import SharedSessionLocal so this module can query the DB in assertions.
# ---------------------------------------------------------------------------
from tests.conftest import SharedSessionLocal

client = TestClient(app)




MOCK_FINAL_STATE = {
    "messages": [HumanMessage(content="hello")],
    "iteration_count": 2,
    "current_plan": "1. Setup\n2. Implement",
    "current_code": "def hello(): return 'world'",
    "reviewer_feedback": "APPROVED",
}


# ===========================================================================
# STEP 3.1 — Expanding Agent State & Pydantic Schemas
# ===========================================================================

class TestStep31_AgentState:
    """Validates the AgentState TypedDict uses the add_messages reducer."""

    def test_messages_key_uses_annotated_add_messages(self):
        """AgentState.messages must be annotated with add_messages."""
        import typing
        hints = typing.get_type_hints(AgentState, include_extras=True)
        msg_annotation = hints["messages"]
        assert hasattr(msg_annotation, "__metadata__"), (
            "AgentState.messages must be an Annotated type with add_messages metadata"
        )
        from langgraph.graph.message import add_messages
        assert add_messages in msg_annotation.__metadata__, (
            "add_messages reducer must be present in AgentState.messages annotation"
        )

    def test_add_messages_reducer_appends_not_overwrites(self):
        """add_messages must concatenate two message lists, not replace."""
        from langgraph.graph.message import add_messages
        existing = [HumanMessage(content="first turn")]
        new_msg  = [HumanMessage(content="second turn")]
        result   = add_messages(existing, new_msg)
        assert len(result) == 2, "add_messages must append, not overwrite"
        assert result[0].content == "first turn"
        assert result[1].content == "second turn"

    def test_agent_state_has_all_required_keys(self):
        """All five state keys must still be present."""
        import typing
        hints = typing.get_type_hints(AgentState, include_extras=True)
        for key in ("messages", "current_plan", "current_code",
                    "reviewer_feedback", "iteration_count"):
            assert key in hints, f"AgentState is missing required key: '{key}'"

    def test_messages_element_type_is_any_message(self):
        """The inner element type of AgentState.messages must be AnyMessage."""
        import typing
        from langchain_core.messages import AnyMessage
        hints    = typing.get_type_hints(AgentState, include_extras=True)
        inner    = hints["messages"].__args__[0]   # list[AnyMessage]
        elem_arg = inner.__args__[0]               # AnyMessage
        assert elem_arg is AnyMessage, f"Expected AnyMessage, got {elem_arg!r}"


class TestStep31_ForgeRequestSchema:
    """Validates ForgeRequest & ResumeRequest Pydantic schema changes."""

    def test_forge_request_accepts_prompt_only(self):
        req = ForgeRequest(prompt="Write a hello world function")
        assert req.prompt == "Write a hello world function"
        assert req.thread_id is None

    def test_forge_request_accepts_optional_thread_id(self):
        tid = uuid.uuid4()
        req = ForgeRequest(prompt="Refactor the function", thread_id=tid)
        assert req.thread_id == tid

    def test_forge_request_rejects_invalid_thread_id(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            ForgeRequest(prompt="test", thread_id="not-a-uuid")

    def test_forge_request_thread_id_defaults_to_none(self):
        fields = ForgeRequest.model_fields
        assert fields["thread_id"].default is None

    def test_resume_request_requires_thread_id(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            ResumeRequest()  # type: ignore[call-arg]

    def test_resume_request_human_feedback_defaults_to_none(self):
        tid = uuid.uuid4()
        req = ResumeRequest(thread_id=tid)
        assert req.human_feedback is None

    def test_resume_request_accepts_human_feedback(self):
        tid = uuid.uuid4()
        req = ResumeRequest(thread_id=tid, human_feedback="Change the background to blue")
        assert req.human_feedback == "Change the background to blue"


# ===========================================================================
# STEP 3.2 — Context-Aware Workflow Nodes
# ===========================================================================

class TestStep32_PlannerNode:
    """Validates planner_node passes the full message history to the LLM."""

    def test_planner_uses_system_message_not_human_message_wrapper(self):
        """planner_node must use SystemMessage and not extract messages[0] only."""
        from app.services.agents.nodes.planner import planner_node
        import inspect
        source = inspect.getsource(planner_node)
        assert "SystemMessage" in source
        assert 'state["messages"][0].content' not in source, (
            "planner_node must not extract only messages[0]; pass the full list"
        )

    def test_planner_passes_full_message_history(self):
        """planner_node must invoke LLM with [SystemMessage] + all state messages."""
        from app.services.agents.nodes import planner as planner_module
        from app.services.agents.nodes.planner import PlannerOutput

        mock_llm    = MagicMock()
        mock_struct = MagicMock()
        mock_llm.with_structured_output.return_value = mock_struct
        mock_struct.invoke.return_value = PlannerOutput(plan="Step 1. Do X\nStep 2. Do Y")

        state: AgentState = {
            "messages": [
                HumanMessage(content="first turn request"),
                AIMessage(content="here is the initial code"),
                HumanMessage(content="now refactor it"),
            ],
            "current_plan": "", "current_code": "",
            "reviewer_feedback": "", "iteration_count": 0,
        }

        with patch.object(planner_module, "get_llm", return_value=mock_llm):
            result = planner_module.planner_node(state)

        mock_struct.invoke.assert_called_once()
        invoked_messages = mock_struct.invoke.call_args[0][0]

        assert isinstance(invoked_messages[0], SystemMessage), (
            "planner_node must prepend a SystemMessage"
        )
        assert len(invoked_messages) == 4, (
            f"Expected [SystemMessage] + 3 state messages = 4, got {len(invoked_messages)}"
        )
        assert invoked_messages[1].content == "first turn request"
        assert invoked_messages[3].content == "now refactor it"
        assert result["current_plan"] == "Step 1. Do X\nStep 2. Do Y"

    def test_planner_returns_correct_keys(self):
        """planner_node return dict must contain 'current_plan' and 'iteration_count'."""
        from app.services.agents.nodes import planner as planner_module
        from app.services.agents.nodes.planner import PlannerOutput

        mock_llm    = MagicMock()
        mock_struct = MagicMock()
        mock_llm.with_structured_output.return_value = mock_struct
        mock_struct.invoke.return_value = PlannerOutput(plan="my plan")

        state: AgentState = {
            "messages": [HumanMessage(content="test")],
            "current_plan": "", "current_code": "",
            "reviewer_feedback": "", "iteration_count": 5,
        }

        with patch.object(planner_module, "get_llm", return_value=mock_llm):
            result = planner_module.planner_node(state)

        assert "current_plan" in result
        assert "iteration_count" in result


class TestStep32_CoderNode:
    """Validates coder_node passes the full message history to the LLM."""

    def test_coder_uses_system_message_not_human_message_wrapper(self):
        """coder_node must use SystemMessage and not extract messages[0] only."""
        from app.services.agents.nodes.coder import coder_node
        import inspect
        source = inspect.getsource(coder_node)
        assert "SystemMessage" in source
        assert 'state["messages"][0].content' not in source

    def test_coder_passes_full_message_history(self):
        """coder_node must invoke LLM with [SystemMessage] + all state messages."""
        from app.services.agents.nodes import coder as coder_module
        from app.services.agents.nodes.coder import CoderOutput

        mock_llm    = MagicMock()
        mock_struct = MagicMock()
        mock_llm.with_structured_output.return_value = mock_struct
        mock_struct.invoke.return_value = CoderOutput(code="def foo(): pass")

        state: AgentState = {
            "messages": [
                HumanMessage(content="original request"),
                AIMessage(content="initial draft"),
                HumanMessage(content="add docstrings"),
            ],
            "current_plan": "Step 1. Build foo()",
            "current_code": "",
            "reviewer_feedback": "",
            "iteration_count": 0,
        }

        with patch.object(coder_module, "get_llm", return_value=mock_llm):
            result = coder_module.coder_node(state)

        invoked_messages = mock_struct.invoke.call_args[0][0]
        assert isinstance(invoked_messages[0], SystemMessage)
        assert len(invoked_messages) == 4
        assert result["current_code"] == "def foo(): pass"
        assert result["iteration_count"] == 1

    def test_coder_includes_feedback_in_system_prompt_when_present(self):
        """When reviewer_feedback is set and not APPROVED, it must appear in sys prompt."""
        from app.services.agents.nodes import coder as coder_module
        from app.services.agents.nodes.coder import CoderOutput

        mock_llm    = MagicMock()
        mock_struct = MagicMock()
        mock_llm.with_structured_output.return_value = mock_struct
        mock_struct.invoke.return_value = CoderOutput(code="def foo(): pass")

        state: AgentState = {
            "messages": [HumanMessage(content="write foo")],
            "current_plan": "make foo",
            "current_code": "def foo(): return None",
            "reviewer_feedback": "Missing docstring and type hints",
            "iteration_count": 1,
        }

        with patch.object(coder_module, "get_llm", return_value=mock_llm):
            coder_module.coder_node(state)

        sys_content = mock_struct.invoke.call_args[0][0][0].content
        assert "Missing docstring" in sys_content
        assert "Previous Code" in sys_content

    def test_coder_does_not_inject_feedback_when_approved(self):
        """When reviewer_feedback == 'APPROVED', it must NOT appear in the sys prompt."""
        from app.services.agents.nodes import coder as coder_module
        from app.services.agents.nodes.coder import CoderOutput

        mock_llm    = MagicMock()
        mock_struct = MagicMock()
        mock_llm.with_structured_output.return_value = mock_struct
        mock_struct.invoke.return_value = CoderOutput(code="def foo(): pass")

        state: AgentState = {
            "messages": [HumanMessage(content="write foo")],
            "current_plan": "make foo",
            "current_code": "def foo(): return None",
            "reviewer_feedback": "APPROVED",
            "iteration_count": 1,
        }

        with patch.object(coder_module, "get_llm", return_value=mock_llm):
            coder_module.coder_node(state)

        sys_content = mock_struct.invoke.call_args[0][0][0].content
        assert "APPROVED" not in sys_content
        assert "Previous Code" not in sys_content



# ===========================================================================
# PHASE 7 STEP 7.1 — reviewer_node Context-Awareness
# ===========================================================================

class TestStep71_ReviewerNode:
    """
    Verifies that reviewer_node was updated to use the [SystemMessage] +
    state["messages"] pattern (Phase 7 Step 7.1), consistent with planner_node
    and coder_node (Phase 6 Step 3.2).

    Prior to this fix the reviewer evaluated code against only
    state["messages"][0].content (the original prompt), making it blind to
    subsequent refinement requests in multi-turn sessions.
    """

    def test_reviewer_uses_system_message_not_human_message_wrapper(self):
        """First element passed to LLM must be a SystemMessage, not HumanMessage."""
        from app.services.agents.nodes import reviewer as reviewer_module
        from app.services.agents.nodes.reviewer import ReviewerOutput

        mock_llm = MagicMock()
        mock_struct = MagicMock()
        mock_llm.with_structured_output.return_value = mock_struct
        mock_struct.invoke.return_value = ReviewerOutput(is_approved=True, feedback="APPROVED")

        state: AgentState = {
            "messages": [HumanMessage(content="build a calculator")],
            "current_plan": "Step 1: implement add()",
            "current_code": "def add(a, b): return a + b",
            "reviewer_feedback": "",
            "iteration_count": 1,
        }

        with patch.object(reviewer_module, "get_llm", return_value=mock_llm):
            reviewer_module.reviewer_node(state)

        invoked_messages = mock_struct.invoke.call_args[0][0]
        assert isinstance(invoked_messages[0], SystemMessage), (
            "First message must be SystemMessage — reviewer must not use HumanMessage wrapper"
        )

    def test_reviewer_passes_full_message_history(self):
        """All state['messages'] must be appended after the SystemMessage."""
        from app.services.agents.nodes import reviewer as reviewer_module
        from app.services.agents.nodes.reviewer import ReviewerOutput

        mock_llm = MagicMock()
        mock_struct = MagicMock()
        mock_llm.with_structured_output.return_value = mock_struct
        mock_struct.invoke.return_value = ReviewerOutput(is_approved=True, feedback="APPROVED")

        state: AgentState = {
            "messages": [
                HumanMessage(content="build a calculator"),
                AIMessage(content="here is the initial code"),
                HumanMessage(content="also add a subtract function"),
            ],
            "current_plan": "Step 1: add(); Step 2: subtract()",
            "current_code": "def add(a, b): return a + b",
            "reviewer_feedback": "",
            "iteration_count": 1,
        }

        with patch.object(reviewer_module, "get_llm", return_value=mock_llm):
            reviewer_module.reviewer_node(state)

        invoked_messages = mock_struct.invoke.call_args[0][0]
        # 1 SystemMessage + 3 state messages = 4 total
        assert len(invoked_messages) == 4, (
            "reviewer must pass [SystemMessage] + all state['messages'] to the LLM"
        )
        assert invoked_messages[1].content == "build a calculator"
        assert invoked_messages[3].content == "also add a subtract function"

    def test_reviewer_embeds_plan_and_code_in_system_message(self):
        """The plan and code to review must appear in the SystemMessage content."""
        from app.services.agents.nodes import reviewer as reviewer_module
        from app.services.agents.nodes.reviewer import ReviewerOutput

        mock_llm = MagicMock()
        mock_struct = MagicMock()
        mock_llm.with_structured_output.return_value = mock_struct
        mock_struct.invoke.return_value = ReviewerOutput(is_approved=False, feedback="Missing subtract")

        state: AgentState = {
            "messages": [HumanMessage(content="build a calculator")],
            "current_plan": "UNIQUE_PLAN_MARKER: build add and subtract",
            "current_code": "UNIQUE_CODE_MARKER: def add(a,b): return a+b",
            "reviewer_feedback": "",
            "iteration_count": 1,
        }

        with patch.object(reviewer_module, "get_llm", return_value=mock_llm):
            reviewer_module.reviewer_node(state)

        sys_content = mock_struct.invoke.call_args[0][0][0].content
        assert "UNIQUE_PLAN_MARKER" in sys_content, "Plan must be embedded in SystemMessage"
        assert "UNIQUE_CODE_MARKER" in sys_content, "Code must be embedded in SystemMessage"

    def test_reviewer_no_longer_accesses_only_first_message(self):
        """
        Regression guard: reviewer must NOT extract user_prompt = messages[0].content
        and embed it as a standalone string. The full history must come from
        state['messages'] being passed wholesale to the LLM.
        """
        from app.services.agents.nodes import reviewer as reviewer_module
        from app.services.agents.nodes.reviewer import ReviewerOutput

        mock_llm = MagicMock()
        mock_struct = MagicMock()
        mock_llm.with_structured_output.return_value = mock_struct
        mock_struct.invoke.return_value = ReviewerOutput(is_approved=True, feedback="APPROVED")

        refinement_content = "REFINEMENT_REQUEST: also handle division by zero"
        state: AgentState = {
            "messages": [
                HumanMessage(content="build a calculator"),
                HumanMessage(content=refinement_content),
            ],
            "current_plan": "Step 1: add()",
            "current_code": "def add(a, b): return a + b",
            "reviewer_feedback": "",
            "iteration_count": 1,
        }

        with patch.object(reviewer_module, "get_llm", return_value=mock_llm):
            reviewer_module.reviewer_node(state)

        invoked_messages = mock_struct.invoke.call_args[0][0]
        # The refinement message must be present in the invoked list
        all_content = " ".join(m.content for m in invoked_messages)
        assert refinement_content in all_content, (
            "Refinement request from turn 2 must be visible to reviewer — "
            "reviewer must not look only at messages[0]"
        )

    def test_reviewer_returns_approved_feedback_string(self):
        """When is_approved=True, reviewer_feedback must be the literal string 'APPROVED'."""
        from app.services.agents.nodes import reviewer as reviewer_module
        from app.services.agents.nodes.reviewer import ReviewerOutput

        mock_llm = MagicMock()
        mock_struct = MagicMock()
        mock_llm.with_structured_output.return_value = mock_struct
        mock_struct.invoke.return_value = ReviewerOutput(is_approved=True, feedback="looks good")

        state: AgentState = {
            "messages": [HumanMessage(content="request")],
            "current_plan": "plan",
            "current_code": "code",
            "reviewer_feedback": "",
            "iteration_count": 1,
        }

        with patch.object(reviewer_module, "get_llm", return_value=mock_llm):
            result = reviewer_module.reviewer_node(state)

        assert result["reviewer_feedback"] == "APPROVED"

    def test_reviewer_returns_feedback_string_when_rejected(self):
        """When is_approved=False, reviewer_feedback must be the LLM's feedback text."""
        from app.services.agents.nodes import reviewer as reviewer_module
        from app.services.agents.nodes.reviewer import ReviewerOutput

        mock_llm = MagicMock()
        mock_struct = MagicMock()
        mock_llm.with_structured_output.return_value = mock_struct
        mock_struct.invoke.return_value = ReviewerOutput(
            is_approved=False, feedback="Missing error handling"
        )

        state: AgentState = {
            "messages": [HumanMessage(content="request")],
            "current_plan": "plan",
            "current_code": "code",
            "reviewer_feedback": "",
            "iteration_count": 1,
        }

        with patch.object(reviewer_module, "get_llm", return_value=mock_llm):
            result = reviewer_module.reviewer_node(state)

        assert result["reviewer_feedback"] == "Missing error handling"


# ===========================================================================
# STEP 3.3 — Stateful Endpoint Modifications
# ===========================================================================

class TestStep33_GenerateEndpoint:
    """Validates the /generate endpoint stateful thread_id wiring."""

    @patch("app.services.agents.workflow.graph.ainvoke", new_callable=AsyncMock)
    def test_new_request_generates_fresh_thread_id(self, mock_ainvoke):
        """When no thread_id supplied, the endpoint must auto-generate a valid UUID."""
        mock_ainvoke.return_value = MOCK_FINAL_STATE
        response = client.post("/api/v1/forge/generate", json={"prompt": "hello world"})

        assert response.status_code == 200
        config = mock_ainvoke.call_args.kwargs.get("config")
        assert config is not None, "config kwarg must be passed to graph.ainvoke"
        thread_id = config["configurable"]["thread_id"]
        uuid.UUID(thread_id)  # raises ValueError if not a valid UUID

    @patch("app.services.agents.workflow.graph.ainvoke", new_callable=AsyncMock)
    def test_request_with_thread_id_passes_it_through(self, mock_ainvoke):
        """A supplied thread_id must be forwarded verbatim to graph.ainvoke."""
        mock_ainvoke.return_value = MOCK_FINAL_STATE
        tid = str(uuid.uuid4())
        response = client.post(
            "/api/v1/forge/generate",
            json={"prompt": "add logging", "thread_id": tid},
        )

        assert response.status_code == 200
        config = mock_ainvoke.call_args.kwargs.get("config")
        assert config["configurable"]["thread_id"] == tid

    @patch("app.services.agents.workflow.graph.ainvoke", new_callable=AsyncMock)
    def test_initial_state_contains_only_new_human_message(self, mock_ainvoke):
        """initial_state must contain ONLY 'messages' — no stale reset fields."""
        mock_ainvoke.return_value = MOCK_FINAL_STATE
        response = client.post(
            "/api/v1/forge/generate",
            json={"prompt": "refactor this", "thread_id": str(uuid.uuid4())},
        )

        assert response.status_code == 200
        initial_state = mock_ainvoke.call_args[0][0]
        keys = set(initial_state.keys())
        assert keys == {"messages"}, (
            f"initial_state must only contain 'messages', found: {keys}"
        )
        assert isinstance(initial_state["messages"][0], HumanMessage)
        assert initial_state["messages"][0].content == "refactor this"

    @patch("app.services.agents.workflow.graph.ainvoke", new_callable=AsyncMock)
    def test_generate_persists_project_to_db(self, mock_ainvoke):
        """Successful /generate must save plan, code, and iterations to the DB."""
        mock_ainvoke.return_value = MOCK_FINAL_STATE
        client.post("/api/v1/forge/generate", json={"prompt": "db test prompt"})

        db = SharedSessionLocal()
        project = db.query(Project).filter_by(user_prompt="db test prompt").first()
        assert project is not None
        assert project.thread_id        is not None
        assert project.final_plan       == MOCK_FINAL_STATE["current_plan"]
        assert project.final_code       == MOCK_FINAL_STATE["current_code"]
        assert project.iterations_taken == MOCK_FINAL_STATE["iteration_count"]
        db.close()

    @patch("app.services.agents.workflow.graph.ainvoke", new_callable=AsyncMock)
    def test_generate_returns_correct_response_schema(self, mock_ainvoke):
        """Response body must match ForgeResponse fields."""
        mock_ainvoke.return_value = MOCK_FINAL_STATE
        response = client.post("/api/v1/forge/generate", json={"prompt": "schema test"})

        assert response.status_code == 200
        data = response.json()
        assert data["plan"]       == MOCK_FINAL_STATE["current_plan"]
        assert data["code"]       == MOCK_FINAL_STATE["current_code"]
        assert data["iterations"] == MOCK_FINAL_STATE["iteration_count"]

    @patch("app.services.agents.workflow.graph.ainvoke", new_callable=AsyncMock)
    def test_generate_returns_500_on_graph_failure(self, mock_ainvoke):
        """Any exception from graph.ainvoke must produce a 500."""
        mock_ainvoke.side_effect = RuntimeError("LLM timeout")
        response = client.post("/api/v1/forge/generate", json={"prompt": "crash test"})

        assert response.status_code == 500
        assert "LLM timeout" in response.json()["detail"]

    def test_generate_rejects_missing_prompt(self):
        """Request without 'prompt' must return HTTP 422."""
        response = client.post(
            "/api/v1/forge/generate",
            json={"thread_id": str(uuid.uuid4())},
        )
        assert response.status_code == 422


# ===========================================================================
# STEP 3.4 — Human-in-the-Loop Foundation
# ===========================================================================

class TestStep34_WorkflowCompilation:
    """Validates the graph is compiled with the HITL interrupt_before config."""

    def test_graph_has_interrupt_before_reviewer(self):
        """
        The compiled graph or its source must declare interrupt_before=["reviewer"].
        We check via source inspection as the most reliable cross-version approach.
        """
        import inspect
        from app.services.agents import workflow as wf_module
        src = inspect.getsource(wf_module)
        assert (
            'interrupt_before=["reviewer"]' in src
            or "interrupt_before=['reviewer']" in src
        ), "workflow.py must compile the graph with interrupt_before=[\"reviewer\"]"


class TestStep34_StreamingHITLDetection:
    """Validates run_agent_stream emits the correct events for HITL vs completion."""

    def _collect(self, initial_state, thread_id, stream_outputs, snapshot):
        """Helper: collect all StreamEvents from run_agent_stream with mocked graph."""
        from app.services.agents.workflow import run_agent_stream

        async def fake_astream(*args, **kwargs):
            for output in stream_outputs:
                yield output

        events = []

        async def collect_async():
            with patch("app.services.agents.workflow.graph.astream", fake_astream), \
                 patch("app.services.agents.workflow.graph.get_state", return_value=snapshot):
                async for ev in run_agent_stream(initial_state, thread_id):
                    events.append(ev)

        asyncio.run(collect_async())
        return events

    def test_stream_emits_interrupted_event_when_graph_paused(self):
        """When snapshot.next == ('reviewer',), an 'interrupted' event must be emitted."""
        snapshot = MagicMock()
        snapshot.next   = ("reviewer",)
        snapshot.values = {"current_code": "def paused(): pass", "current_plan": "paused plan"}

        events = self._collect(
            {"messages": [HumanMessage(content="test")]},
            str(uuid.uuid4()),
            [{"coder": {"current_code": "def paused(): pass", "iteration_count": 1}}],
            snapshot,
        )

        types = [e.type for e in events]
        assert "interrupted" in types, f"Expected 'interrupted' event, got: {types}"

        ev = next(e for e in events if e.type == "interrupted")
        assert ev.node == "reviewer"
        assert ev.state is not None
        assert "current_code" in ev.state
        assert ev.state["current_code"] == "def paused(): pass"

    def test_stream_emits_complete_event_when_graph_finishes(self):
        """When snapshot.next is empty, a 'complete' event must be emitted."""
        snapshot = MagicMock()
        snapshot.next = ()

        events = self._collect(
            {"messages": [HumanMessage(content="test")]},
            str(uuid.uuid4()),
            [{"reviewer": {"reviewer_feedback": "APPROVED", "iteration_count": 1}}],
            snapshot,
        )

        types = [e.type for e in events]
        assert "complete" in types, f"Expected 'complete' event, got: {types}"
        assert "interrupted" not in types

    def test_stream_emits_node_finish_for_each_node(self):
        """Each node output must produce a corresponding node_finish event."""
        snapshot = MagicMock()
        snapshot.next = ()

        events = self._collect(
            {"messages": [HumanMessage(content="test")]},
            str(uuid.uuid4()),
            [
                {"planner": {"current_plan": "plan", "iteration_count": 0}},
                {"coder":   {"current_code": "code", "iteration_count": 1}},
            ],
            snapshot,
        )

        finish_nodes = [e.node for e in events if e.type == "node_finish"]
        assert "planner" in finish_nodes
        assert "coder"   in finish_nodes

    def test_interrupted_message_references_resume_endpoint(self):
        """The 'interrupted' event message must reference the /resume endpoint."""
        snapshot = MagicMock()
        snapshot.next   = ("reviewer",)
        snapshot.values = {"current_code": "code", "current_plan": "plan"}

        events = self._collect(
            {"messages": [HumanMessage(content="test")]},
            str(uuid.uuid4()),
            [{"coder": {"current_code": "code", "iteration_count": 1}}],
            snapshot,
        )

        ev = next((e for e in events if e.type == "interrupted"), None)
        assert ev is not None
        assert "/resume" in ev.message, (
            "Interrupted event must reference the /resume endpoint in its message"
        )


class TestStep34_ResumeEndpoint:
    """Validates the POST /resume endpoint end-to-end behaviour."""

    def _paused_snapshot(self, code="def foo(): pass", plan="do foo"):
        snap = MagicMock()
        snap.next   = ("reviewer",)
        snap.values = {"current_code": code, "current_plan": plan}
        return snap

    def _done_snapshot(self):
        snap = MagicMock()
        snap.next   = ()
        snap.values = {}
        return snap

    @patch("app.services.agents.workflow.graph.get_state")
    @patch("app.services.agents.workflow.graph.update_state")
    @patch("app.services.agents.workflow.graph.ainvoke", new_callable=AsyncMock)
    def test_resume_returns_400_when_thread_not_paused(
        self, mock_ainvoke, mock_update, mock_get_state
    ):
        """Thread not at a breakpoint must return 400."""
        mock_get_state.return_value = self._done_snapshot()
        response = client.post(
            "/api/v1/forge/resume", json={"thread_id": str(uuid.uuid4())}
        )
        assert response.status_code == 400
        assert "not currently paused" in response.json()["detail"]
        mock_ainvoke.assert_not_called()

    @patch("app.services.agents.workflow.graph.get_state")
    @patch("app.services.agents.workflow.graph.update_state")
    @patch("app.services.agents.workflow.graph.ainvoke", new_callable=AsyncMock)
    def test_resume_without_feedback_skips_update_state(
        self, mock_ainvoke, mock_update, mock_get_state
    ):
        """Without human_feedback, update_state must NOT be called."""
        mock_get_state.return_value = self._paused_snapshot()
        mock_ainvoke.return_value   = MOCK_FINAL_STATE
        response = client.post(
            "/api/v1/forge/resume", json={"thread_id": str(uuid.uuid4())}
        )
        assert response.status_code == 200
        mock_update.assert_not_called()

    @patch("app.services.agents.workflow.graph.get_state")
    @patch("app.services.agents.workflow.graph.update_state")
    @patch("app.services.agents.workflow.graph.ainvoke", new_callable=AsyncMock)
    def test_resume_with_feedback_calls_update_state_with_human_message(
        self, mock_ainvoke, mock_update, mock_get_state
    ):
        """With human_feedback, update_state must be called with a HumanMessage."""
        mock_get_state.return_value = self._paused_snapshot()
        mock_ainvoke.return_value   = MOCK_FINAL_STATE
        feedback = "Please add type hints to all function signatures"
        response = client.post(
            "/api/v1/forge/resume",
            json={"thread_id": str(uuid.uuid4()), "human_feedback": feedback},
        )
        assert response.status_code == 200
        mock_update.assert_called_once()
        injected = mock_update.call_args[0][1]["messages"]
        assert len(injected) == 1
        assert isinstance(injected[0], HumanMessage)
        assert injected[0].content == feedback

    @patch("app.services.agents.workflow.graph.get_state")
    @patch("app.services.agents.workflow.graph.update_state")
    @patch("app.services.agents.workflow.graph.ainvoke", new_callable=AsyncMock)
    def test_resume_invokes_graph_with_none_input(
        self, mock_ainvoke, mock_update, mock_get_state
    ):
        """graph.ainvoke must be called with None to resume from checkpoint."""
        mock_get_state.return_value = self._paused_snapshot()
        mock_ainvoke.return_value   = MOCK_FINAL_STATE
        tid = str(uuid.uuid4())
        client.post("/api/v1/forge/resume", json={"thread_id": tid})

        assert mock_ainvoke.call_args[0][0] is None, (
            "graph.ainvoke must be called with None to resume from checkpoint"
        )
        config = mock_ainvoke.call_args.kwargs.get("config")
        assert config["configurable"]["thread_id"] == tid

    @patch("app.services.agents.workflow.graph.get_state")
    @patch("app.services.agents.workflow.graph.update_state")
    @patch("app.services.agents.workflow.graph.ainvoke", new_callable=AsyncMock)
    def test_resume_persists_result_to_db(
        self, mock_ainvoke, mock_update, mock_get_state
    ):
        """A successful /resume must persist the final code to the DB."""
        mock_get_state.return_value = self._paused_snapshot()
        mock_ainvoke.return_value   = MOCK_FINAL_STATE
        tid = str(uuid.uuid4())
        client.post("/api/v1/forge/resume", json={"thread_id": tid})

        db = SharedSessionLocal()
        project = db.query(Project).filter(
            Project.user_prompt.like(f"%{tid}%")
        ).first()
        assert project is not None, "Resumed project must be saved to the DB"
        assert project.thread_id == tid
        assert project.final_code == MOCK_FINAL_STATE["current_code"]
        db.close()

    @patch("app.services.agents.workflow.graph.get_state")
    @patch("app.services.agents.workflow.graph.update_state")
    @patch("app.services.agents.workflow.graph.ainvoke", new_callable=AsyncMock)
    def test_resume_returns_correct_forge_response(
        self, mock_ainvoke, mock_update, mock_get_state
    ):
        """POST /resume must return a ForgeResponse-shaped JSON body."""
        mock_get_state.return_value = self._paused_snapshot()
        mock_ainvoke.return_value   = MOCK_FINAL_STATE
        response = client.post(
            "/api/v1/forge/resume", json={"thread_id": str(uuid.uuid4())}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["plan"]       == MOCK_FINAL_STATE["current_plan"]
        assert data["code"]       == MOCK_FINAL_STATE["current_code"]
        assert data["iterations"] == MOCK_FINAL_STATE["iteration_count"]

    @patch("app.services.agents.workflow.graph.get_state")
    @patch("app.services.agents.workflow.graph.update_state")
    @patch("app.services.agents.workflow.graph.ainvoke", new_callable=AsyncMock)
    def test_resume_returns_500_on_graph_failure(
        self, mock_ainvoke, mock_update, mock_get_state
    ):
        """If graph.ainvoke raises after resume, the endpoint must return 500."""
        mock_get_state.return_value = self._paused_snapshot()
        mock_ainvoke.side_effect    = RuntimeError("Groq timeout on resume")
        response = client.post(
            "/api/v1/forge/resume", json={"thread_id": str(uuid.uuid4())}
        )
        assert response.status_code == 500
        assert "Groq timeout on resume" in response.json()["detail"]

    def test_resume_rejects_invalid_thread_id_format(self):
        """Supplying a non-UUID thread_id must return HTTP 422."""
        response = client.post(
            "/api/v1/forge/resume", json={"thread_id": "not-a-uuid"}
        )
        assert response.status_code == 422


# ===========================================================================
# PHASE 7 STEP 3.6 — WebSocket Resume Streaming
# ===========================================================================

class TestStep736_ResumeStreaming:
    """Validates the run_agent_stream(initial_state=None) mode and /ws/resume endpoint."""

    def test_run_agent_stream_yields_resuming_message(self):
        """When initial_state is None, node_start must indicate resumption."""
        from app.services.agents.workflow import run_agent_stream
        from app.schemas.streaming import StreamEvent

        async def fake_astream(*args, **kwargs):
            yield {"coder": {"current_code": "code"}}

        snapshot = MagicMock()
        snapshot.next = ()

        events = []
        async def collect():
            with patch("app.services.agents.workflow.graph.astream", fake_astream), \
                 patch("app.services.agents.workflow.graph.get_state", return_value=snapshot):
                async for ev in run_agent_stream(None, str(uuid.uuid4())):
                    events.append(ev)

        asyncio.run(collect())
        
        start_ev = events[0]
        assert start_ev.type == "node_start"
        assert "Resuming" in start_ev.message

    @patch("app.api.websockets.agent_stream.wf_module.graph.get_state")
    def test_ws_resume_rejects_missing_thread_id(self, mock_get_state):
        """WebSocket connection must be rejected if thread_id is missing."""
        with client.websocket_connect("/api/v1/ws/forge/resume") as websocket:
            websocket.send_json({})  # Missing thread_id
            data = websocket.receive_json()
            assert data["type"] == "error"
            assert "thread_id is required" in data["message"]
        mock_get_state.assert_not_called()

    @patch("app.api.websockets.agent_stream.wf_module.graph.get_state")
    def test_ws_resume_rejects_not_paused_thread(self, mock_get_state):
        """If the thread is not paused at 'reviewer', the WebSocket must return an error."""
        snap = MagicMock()
        snap.next = ()
        mock_get_state.return_value = snap
        
        with client.websocket_connect("/api/v1/ws/forge/resume") as websocket:
            websocket.send_json({"thread_id": str(uuid.uuid4())})
            data = websocket.receive_json()
            assert data["type"] == "error"
            assert "not currently paused" in data["message"]

    @patch("app.api.websockets.agent_stream.wf_module.graph.update_state")
    @patch("app.api.websockets.agent_stream.wf_module.graph.get_state")
    @patch("app.api.websockets.agent_stream.run_agent_stream")
    def test_ws_resume_streams_success(self, mock_run, mock_get, mock_update):
        """Validates that a valid resume request streams the resumed events correctly."""
        snap = MagicMock()
        snap.next = ("reviewer",)
        mock_get.return_value = snap
        
        from app.schemas.streaming import StreamEvent
        
        async def fake_stream(*args, **kwargs):
            yield StreamEvent(type="node_start", node="system", message="Resuming...")
            yield StreamEvent(type="node_finish", node="reviewer", state={"current_code": "def foo(): pass"})
            yield StreamEvent(type="complete", node="system", message="Done")
            
        mock_run.side_effect = fake_stream
        
        thread_id = str(uuid.uuid4())
        feedback = "Looks good"
        
        with client.websocket_connect("/api/v1/ws/forge/resume") as websocket:
            websocket.send_json({
                "thread_id": thread_id,
                "human_feedback": feedback
            })
            
            ev1 = websocket.receive_json()
            assert ev1["type"] == "node_start"
            
            ev2 = websocket.receive_json()
            assert ev2["type"] == "node_finish"
            assert ev2["node"] == "reviewer"
            assert ev2["state"]["current_code"] == "def foo(): pass"
            
            ev3 = websocket.receive_json()
            assert ev3["type"] == "complete"
            
        mock_update.assert_called_once()
        injected = mock_update.call_args[0][1]["messages"]
        assert len(injected) == 1
        assert getattr(injected[0], "content", injected[0]) == feedback
class TestStep34_StreamEventSchema:
    """Validates the StreamEvent schema extension for the 'interrupted' type."""

    def test_stream_event_accepts_interrupted_type(self):
        """StreamEvent must accept 'interrupted' as a valid type value."""
        ev = StreamEvent(
            type="interrupted",
            node="reviewer",
            state={"current_code": "def foo(): pass", "current_plan": "plan"},
            message="Paused at HITL breakpoint. Call /resume to continue.",
        )
        assert ev.type == "interrupted"
        assert ev.node == "reviewer"
        assert ev.state["current_code"] == "def foo(): pass"

    def test_stream_event_type_description_mentions_interrupted(self):
        """The type field description must document the 'interrupted' event."""
        field = StreamEvent.model_fields["type"]
        desc  = field.description or ""
        assert "interrupted" in desc, (
            "StreamEvent.type description must document the 'interrupted' event type"
        )
