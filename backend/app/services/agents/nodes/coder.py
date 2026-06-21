from pydantic import BaseModel, Field
from langchain_core.messages import SystemMessage
from langchain_core.runnables import RunnableConfig
from app.services.llm.factory import get_llm
from app.services.agents.state import AgentState

class CoderOutput(BaseModel):
    code: str = Field(description="The complete, fully functional code implementing the plan")

def coder_node(state: AgentState, config: RunnableConfig) -> dict:
    configurable = config.get("configurable", {})
    provider = configurable.get("llm_provider", "groq")
    api_key = configurable.get("api_key")
    
    llm = get_llm(provider, api_key)
    structured_llm = llm.with_structured_output(CoderOutput)
    
    plan = state.get("current_plan", "")
    feedback = state.get("reviewer_feedback", "")
    previous_code = state.get("current_code", "")
    
    sys_prompt = f"""You are an expert Senior Software Engineer.
Your task is to write code based on the plan to solve the user's request.

Plan: {plan}
"""
    if feedback and feedback != "APPROVED":
        sys_prompt += f"\nPrevious Code:\n{previous_code}\n\nReviewer Feedback:\n{feedback}\n\nPlease fix the issues mentioned in the feedback."
        
    messages = [SystemMessage(content=sys_prompt)] + state["messages"]
    response = structured_llm.invoke(messages)
    code = response.code
    
    import subprocess
    try:
        # Secure code execution sandboxing using Docker
        result = subprocess.run(
            [
                "docker", "run", "--rm", 
                "--network", "none", 
                "--memory", "128m", 
                "--cpus", "0.5",
                "python:3.11-slim", 
                "python", "-c", code
            ],
            capture_output=True,
            text=True,
            timeout=15
        )
        sandbox_result = result.stdout
        if result.stderr:
            sandbox_result += f"\n{result.stderr}"
        if not sandbox_result:
            sandbox_result = "Code executed successfully with no output."
    except subprocess.TimeoutExpired:
        sandbox_result = "Execution Error: Code timed out after 5 seconds."
    except Exception as e:
        sandbox_result = f"Execution Error: {str(e)}"
    
    return {
        "current_code": code,
        "iteration_count": state.get("iteration_count", 0) + 1,
        "sandbox_result": sandbox_result
    }
