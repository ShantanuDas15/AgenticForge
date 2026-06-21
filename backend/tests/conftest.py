"""
Shared test infrastructure for all test modules.

Both tests/api/test_forge.py and tests/test_phase6.py previously defined
their own in-memory SQLite engine independently. When run together, the
app.dependency_overrides[get_db] was last-writer-wins, causing DB state bleed
between modules. This conftest centralises the single shared engine and the
get_db override so all modules are consistent.

Graph Bootstrap
---------------
In production, the LangGraph workflow graph is compiled inside the FastAPI
lifespan context manager using AsyncSqliteSaver (Phase 7). In tests we
bootstrap it here with MemorySaver so the module-level `graph` reference is
non-None when patch() targets graph.ainvoke / graph.get_state / etc.
The MemorySaver is sufficient for unit tests because all graph calls are
mocked — the checkpointer type only matters for live integration tests.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from langgraph.checkpoint.memory import MemorySaver

from app.main import app
from app.db.database import get_db
from app.api.dependencies import get_current_user
from app.models import Base
from app.models.project import Project
from app.models.user import User
from app.services.agents.workflow import compile_graph

# ---------------------------------------------------------------------------
# Bootstrap the graph with a MemorySaver so `graph` is non-None during tests.
# ---------------------------------------------------------------------------
compile_graph(MemorySaver())

# ---------------------------------------------------------------------------
# Single shared in-memory engine for the entire test session
# ---------------------------------------------------------------------------
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
shared_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
SharedSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=shared_engine)
Base.metadata.create_all(bind=shared_engine)


def override_get_db():
    db = SharedSessionLocal()
    try:
        yield db
    finally:
        db.close()


def override_get_current_user():
    # Return a mock user with active status and Free Developer tier for testing
    return User(
        id=1,
        email="architect@domain.com",
        name="Senior Architect",
        is_active=True,
        subscription_tier="Free Developer"
    )


# Apply the overrides once here — all test modules inherit them
app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user


@pytest.fixture(autouse=True)
def clean_db_between_tests():
    """Wipe all projects and users, then seed the mock user before every test for full isolation."""
    db = SharedSessionLocal()
    db.query(Project).delete()
    db.query(User).delete()
    
    # Seed mock user with ID 1 to match dependency override
    mock_user = User(
        id=1,
        email="architect@domain.com",
        name="Senior Architect",
        hashed_password="mocked_password_hash",
        is_active=True,
        subscription_tier="Free Developer"
    )
    db.add(mock_user)
    db.commit()
    db.close()
    yield
