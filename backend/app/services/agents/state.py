from typing import TypedDict, Annotated, List
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    """
    Represents the state of our multi-agent workflow.
    """
    messages: Annotated[list[AnyMessage], add_messages]
    current_plan: str
    current_code: str
    workspace_files: list[dict]
    reviewer_feedback: str
    iteration_count: int
    sandbox_result: str
