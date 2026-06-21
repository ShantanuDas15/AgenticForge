from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.usage import TokenUsage

router = APIRouter(dependencies=[Depends(get_current_user)])

from app.models.user import User

@router.get("/weekly")
def get_weekly_usage(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Returns aggregated token usage for the last 7 days for the authenticated user.
    Formats the output specifically for the Recharts UsageChart component.
    """
    user_id = current_user.id
    
    end_date = date.today()
    start_date = end_date - timedelta(days=6)
    
    # Query aggregated tokens grouped by date
    results = db.query(
        TokenUsage.date,
        func.sum(TokenUsage.tokens).label('total_tokens')
    ).filter(
        TokenUsage.user_id == user_id,
        TokenUsage.date >= start_date,
        TokenUsage.date <= end_date
    ).group_by(TokenUsage.date).all()
    
    # Convert results to a dictionary mapped by date
    usage_map = {res.date: res.total_tokens for res in results}
    
    # Generate the last 7 days array to ensure 0-token days are included
    # Recharts expects: [{ name: 'Mon', tokens: 4000 }, ...]
    formatted_data = []
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    
    for i in range(7):
        current_date = start_date + timedelta(days=i)
        day_name = days[current_date.weekday()]
        tokens = usage_map.get(current_date, 0)
        formatted_data.append({
            "name": day_name,
            "tokens": tokens,
            "full_date": str(current_date)
        })
        
    return formatted_data
