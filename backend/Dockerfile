# Stage 1: Builder
FROM python:3.14-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install uv for blazingly fast dependency resolution
RUN pip install --no-cache-dir uv

# Copy configuration files
COPY pyproject.toml uv.lock ./

# Create a virtual environment and install dependencies directly into it
RUN uv venv /app/.venv && \
    uv pip install --system --python /app/.venv -r pyproject.toml

# Stage 2: Runtime
FROM python:3.14-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Create a secure, non-root user
RUN useradd -m -s /bin/bash appuser && \
    chown -R appuser:appuser /app

# Copy the pre-built virtual environment from the builder stage
COPY --from=builder --chown=appuser:appuser /app/.venv /app/.venv

# Copy the rest of the application code
COPY --chown=appuser:appuser . .

# Switch to the non-root user for execution
USER appuser

EXPOSE 8000

# Run the FastAPI application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
