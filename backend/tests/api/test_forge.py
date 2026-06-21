import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.models.project import Project

# DB engine, session, and get_db override are provided by tests/conftest.py.
# Import SharedSessionLocal so this module can query the DB in assertions.
from tests.conftest import SharedSessionLocal

# Initialize the TestClient (get_db already overridden by conftest)
client = TestClient(app)

@patch("app.services.agents.workflow.graph.ainvoke", new_callable=AsyncMock)
def test_generate_code_success(mock_ainvoke):
    """
    Test that the /generate endpoint successfully accepts a request,
    calls the LangGraph workflow, saves to the DB, and returns the expected response.
    """
    # 1. Arrange: Setup the mock LangGraph response
    # We mock this to avoid hitting the actual Groq API during automated tests
    mock_final_state = {
        "messages": [],
        "iteration_count": 2,
        "current_plan": "1. Setup\n2. Execute",
        "current_code": "def hello_world():\n    print('Hello')",
        "reviewer_feedback": "APPROVED"
    }
    mock_ainvoke.return_value = mock_final_state

    request_payload = {
        "prompt": "Write a python hello world function"
    }

    # 2. Act: Call the endpoint
    # Note: Adjust the prefix if your router is mounted differently.
    # The main.py typically mounts api_router with prefix "/api/v1".
    response = client.post("/api/v1/forge/generate", json=request_payload)

    # 3. Assert: Verify the HTTP response
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["plan"] == mock_final_state["current_plan"]
    assert data["code"] == mock_final_state["current_code"]
    assert data["iterations"] == mock_final_state["iteration_count"]

    # 4. Assert: Verify the mock was called correctly with the Phase 6 minimal initial state.
    # After Step 3.3, initial_state contains ONLY 'messages' so LangGraph can load and
    # append to the existing checkpoint rather than resetting it.
    mock_ainvoke.assert_called_once()
    call_args = mock_ainvoke.call_args[0][0]
    assert set(call_args.keys()) == {"messages"}, (
        "initial_state must contain only 'messages' (Step 3.3 minimalism contract)"
    )
    assert call_args["messages"][0].content == request_payload["prompt"]

    # 5. Assert: Verify database persistence
    db = SharedSessionLocal()
    project = db.query(Project).first()
    assert project is not None
    assert project.thread_id is not None
    assert project.user_prompt == request_payload["prompt"]
    assert project.final_plan == mock_final_state["current_plan"]
    assert project.final_code == mock_final_state["current_code"]
    assert project.iterations_taken == mock_final_state["iteration_count"]
    db.close()

@patch("app.services.agents.workflow.graph.ainvoke", new_callable=AsyncMock)
def test_generate_code_graph_failure(mock_ainvoke):
    """
    Test that the endpoint properly handles exceptions thrown by the LangGraph workflow.
    """
    # 1. Arrange: Simulate an error during graph execution (e.g., API key issue or timeout)
    mock_ainvoke.side_effect = Exception("Groq API connection error")

    request_payload = {
        "prompt": "Write a python hello world function"
    }

    # 2. Act
    response = client.post("/api/v1/forge/generate", json=request_payload)

    # 3. Assert: HTTP status and error detail
    assert response.status_code == 500
    assert "Groq API connection error" in response.json()["detail"]

    # 4. Assert: Verify no project was saved to the DB due to the failure
    db = SharedSessionLocal()
    project = db.query(Project).first()
    assert project is None
    db.close()

def test_generate_code_validation_error():
    """
    Test that the endpoint properly validates incoming requests based on Pydantic schemas.
    """
    # 1. Arrange: Missing 'prompt' field
    invalid_payload = {
        "wrong_field": "Write a python hello world function"
    }

    # 2. Act
    response = client.post("/api/v1/forge/generate", json=invalid_payload)

    # 3. Assert: HTTP 422 Unprocessable Entity
    assert response.status_code == 422
    assert "prompt" in response.text

@patch("app.api.routes.forge.wf_module.graph.aget_state_history")
def test_get_thread_history_success(mock_history):
    """
    Test that the /threads/{thread_id}/history endpoint successfully retrieves and formats history.
    """
    import uuid
    from unittest.mock import MagicMock
    
    # Arrange: mock the async generator
    async def fake_history(*args, **kwargs):
        snap1 = MagicMock()
        snap1.values = {
            "current_plan": "plan 1", 
            "current_code": "code 1", 
            "reviewer_feedback": "APPROVED"
        }
        snap1.created_at = "2026-06-17T12:00:00Z"
        
        snap2 = MagicMock()
        snap2.values = {
            "current_plan": "plan 0", 
            "current_code": "code 0"
        }
        snap2.created_at = "2026-06-17T11:00:00Z"
        
        yield snap1
        yield snap2

    mock_history.side_effect = fake_history
    
    thread_id = str(uuid.uuid4())
    
    # Act
    response = client.get(f"/api/v1/forge/threads/{thread_id}/history")
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    
    assert data["thread_id"] == thread_id
    assert len(data["history"]) == 2
    
    assert data["history"][0]["plan"] == "plan 1"
    assert data["history"][0]["code"] == "code 1"
    assert data["history"][0]["reviewer_feedback"] == "APPROVED"
    assert data["history"][0]["created_at"] == "2026-06-17T12:00:00Z"
    
    assert data["history"][1]["plan"] == "plan 0"
    assert data["history"][1]["code"] == "code 0"
    assert data["history"][1]["reviewer_feedback"] is None
    assert data["history"][1]["created_at"] == "2026-06-17T11:00:00Z"

def test_get_thread_history_invalid_uuid():
    """
    Test that invalid UUID format returns a 422 error.
    """
    response = client.get("/api/v1/forge/threads/invalid-id/history")
    assert response.status_code == 422
    assert "Invalid thread_id format" in response.text
