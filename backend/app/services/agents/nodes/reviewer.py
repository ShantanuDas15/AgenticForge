from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage
from langchain_core.runnables import RunnableConfig
from app.services.llm.factory import get_llm
from app.services.agents.state import AgentState


class ReviewerOutput(BaseModel):
    is_approved: bool = Field(
        description="True if the code correctly implements the plan and fulfils ALL requests in the conversation history. False otherwise."
    )
    feedback: str = Field(
        description="Detailed, actionable feedback on what needs to be fixed. If approved, return 'APPROVED'."
    )


def reviewer_node(state: AgentState, config: RunnableConfig) -> dict:
    """
    Evaluates the generated code against the technical plan and the full
    conversation history (Phase 7 Step 7.1).
    """
    configurable = config.get("configurable", {})
    provider = configurable.get("llm_provider", "groq")
    api_key = configurable.get("api_key")
    
    llm = get_llm(provider, api_key)
    structured_llm = llm.with_structured_output(ReviewerOutput)

    plan = state.get("current_plan", "")
    code = state.get("current_code", "")
    sandbox_result = state.get("sandbox_result", "No output generated.")

    sys_msg = SystemMessage(content=f"""You are an expert Code Reviewer.
Your task is to evaluate the generated code against the original user request,
any subsequent refinement requests in the conversation history, and the technical plan.

Technical Plan:
{plan}

Code to Review:
{code}

Execution Output (Sandbox):
{sandbox_result}

Instructions:
- If the code correctly fulfils ALL requests in the conversation history and the plan with no obvious bugs, set is_approved to true and feedback to 'APPROVED'.
- If the code has issues, does not satisfy a refinement request, or fails during execution, set is_approved to false and provide specific, actionable feedback.
- Pay attention to ALL messages in the conversation history, not just the first request.""")

    # Pass the full message history so the reviewer evaluates code against
    # every turn of the conversation, not only the original prompt.
    messages = [sys_msg] + state["messages"]
    response = structured_llm.invoke(messages)

    feedback_str = "APPROVED" if response.is_approved else response.feedback

    return {
        "reviewer_feedback": feedback_str
    }

