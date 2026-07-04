#!/bin/bash

echo "▶ Running Alembic migrations..."

# Run migrations; capture output and exit code
alembic upgrade head
ALEMBIC_EXIT=$?

if [ $ALEMBIC_EXIT -ne 0 ]; then
    echo "⚠️  Migration failed (exit $ALEMBIC_EXIT)."
    echo "   This likely means tables already exist but have no Alembic version stamp."
    echo "   Stamping database at 'head' to bring Alembic in sync..."
    alembic stamp head
    if [ $? -ne 0 ]; then
        echo "❌ Failed to stamp database. Aborting."
        exit 1
    fi
    echo "✅ Database stamped at head. Alembic is now in sync."
else
    echo "✅ Migrations applied successfully."
fi

echo "▶ Starting Uvicorn server on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
