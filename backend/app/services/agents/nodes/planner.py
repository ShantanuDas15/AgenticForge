from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage
from langchain_core.runnables import RunnableConfig
from app.services.llm.factory import get_llm
from app.services.agents.state import AgentState

class PlannerOutput(BaseModel):
    plan: str = Field(description="Step-by-step technical plan to solve the user's request")

def planner_node(state: AgentState, config: RunnableConfig) -> dict:
    configurable = config.get("configurable", {})
    provider = configurable.get("llm_provider", "groq")
    api_key = configurable.get("api_key")
    
    llm = get_llm(provider, api_key)
    structured_llm = llm.with_structured_output(PlannerOutput)
    
    sys_msg = SystemMessage(content="""You are an expert Software Architect.
Your task is to create a detailed, step-by-step technical plan to fulfill the user's request.
Return ONLY the structured plan.""")
    
    messages = [sys_msg] + state["messages"]
    response = structured_llm.invoke(messages)
    
    return {
        "current_plan": response.plan,
        "iteration_count": state.get("iteration_count", 0)
    }
