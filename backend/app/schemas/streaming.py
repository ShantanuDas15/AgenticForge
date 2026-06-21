from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class StreamEvent(BaseModel):
    """
    Strict data contract for Real-Time WebSocket state broadcasts.
    Ensures the React frontend receives predictable, typed payloads to trigger UI animations.
    """
    type: str = Field(
        ..., 
        description=(
            "The event category: 'node_start', 'node_finish', 'interrupted', 'error', 'sandbox_output', or 'complete'. "
            "'interrupted' is emitted when the graph pauses at a Human-in-the-Loop breakpoint "
            "(e.g., before the reviewer node) and is awaiting human input via the /resume endpoint. "
            "'sandbox_output' streams stdout/stderr from local code execution."
        )
    )
    node: Optional[str] = Field(
        None, 
        description="The specific LangGraph node involved: e.g., 'planner', 'coder', 'reviewer'"
    )
    state: Optional[Dict[str, Any]] = Field(
        None, 
        description="The current AgentState diff payload (e.g., plan string, code snippet)"
    )
    message: Optional[str] = Field(
        None, 
        description="An optional human-readable status message for the UI logger"
    )
