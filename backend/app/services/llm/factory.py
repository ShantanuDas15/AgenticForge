from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from app.core.config import settings

def get_llm(provider: str = "groq", api_key: str = None):
    """
    Dynamically instantiate the requested ChatModel based on frontend preferences.
    """
    provider = provider.lower() if provider else "groq"
    
    if provider == "openai":
        key = api_key or settings.OPENAI_API_KEY
        if not key:
            raise ValueError("OpenAI API key is missing.")
        return ChatOpenAI(api_key=key, model="gpt-4o", temperature=0.0)
        
    elif provider == "anthropic":
        key = api_key or settings.ANTHROPIC_API_KEY
        if not key:
            raise ValueError("Anthropic API key is missing.")
        return ChatAnthropic(api_key=key, model="claude-3-5-sonnet-20240620", temperature=0.0)
        
    else: # default to groq
        key = api_key or settings.GROQ_API_KEY
        if not key:
            raise ValueError("GROQ_API_KEY is missing.")
        return ChatGroq(api_key=key, model="llama-3.3-70b-versatile", temperature=0.0)

def test_llm_connection(prompt: str = "Say 'Hello, AgenticForge is alive!'", provider: str = "groq", api_key: str = None) -> str:
    llm = get_llm(provider, api_key)
    response = llm.invoke(prompt)
    return response.content
