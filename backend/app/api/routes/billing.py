import os
import stripe
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import StreamingResponse
import asyncio
import json

class BillingEventManager:
    def __init__(self):
        self.connections = {}

    def connect(self, user_id: int):
        q = asyncio.Queue()
        if user_id not in self.connections:
            self.connections[user_id] = []
        self.connections[user_id].append(q)
        return q

    def disconnect(self, user_id: int, q: asyncio.Queue):
        if user_id in self.connections:
            if q in self.connections[user_id]:
                self.connections[user_id].remove(q)
            if not self.connections[user_id]:
                del self.connections[user_id]

    async def broadcast(self, user_id: int, data: dict):
        if user_id in self.connections:
            for q in self.connections[user_id]:
                await q.put(data)

billing_events = BillingEventManager()
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api.dependencies import get_current_user
from app.schemas.billing import BillingStatusResponse, CheckoutRequest, CheckoutResponse, WebhookPayload
from app.models.user import User

router = APIRouter()

@router.get("/status", response_model=BillingStatusResponse)
def get_billing_status(current_user: User = Depends(get_current_user)):
    """
    Fetch the active subscription tier for the current authenticated user.
    """
    return BillingStatusResponse(
        subscription_tier=current_user.subscription_tier,
        is_active=current_user.is_active
    )

@router.post("/upgrade", response_model=CheckoutResponse)
def create_checkout_session(request: CheckoutRequest, current_user: User = Depends(get_current_user)):
    """
    Generates a Stripe checkout URL for upgrading to a higher tier.
    """
    if request.tier_id not in ["pro_architect"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tier ID")
        
    stripe_key = os.environ.get("STRIPE_API_KEY")
    if not stripe_key:
        # Fallback for local demo purposes to keep frontend fully unblocked
        mock_checkout_url = f"https://buy.stripe.com/mock_checkout_session?email={current_user.email}&tier={request.tier_id}"
        return CheckoutResponse(checkout_url=mock_checkout_url)

    stripe.api_key = stripe_key
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': 'Pro Architect Subscription',
                    },
                    'unit_amount': 4900,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{os.environ.get('FRONTEND_URL', 'http://localhost:5173')}/settings?upgrade=success",
            cancel_url=f"{os.environ.get('FRONTEND_URL', 'http://localhost:5173')}/settings?upgrade=canceled",
            customer_email=current_user.email,
            metadata={
                'tier_id': request.tier_id
            }
        )
        return CheckoutResponse(checkout_url=session.url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stripe Checkout error: {str(e)}")

@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Stripe webhook endpoint for async payment confirmation.
    Verifies Stripe signature using the raw request body.
    """
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")
    endpoint_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "whsec_mock")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except ValueError as e:
        # Invalid payload
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        
        email = session.get('customer_email') or session.get('customer_details', {}).get('email')
        tier_id = session.get('metadata', {}).get('tier_id', 'pro_architect')
        
        if email:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                return {"received": True, "message": "User not found"}
                
            user.subscription_tier = tier_id
            user.is_active = True
            db.commit()
            
            await billing_events.broadcast(user.id, {"tier": user.subscription_tier, "is_active": user.is_active})
            
            return {"received": True, "message": f"Upgraded {email} to {tier_id}"}
            
    return {"received": True, "message": "Ignored non-success status or unhandled event"}

@router.post("/downgrade", status_code=status.HTTP_200_OK)
async def downgrade_subscription(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Downgrade user subscription to Free Developer.
    """
    if current_user.subscription_tier == "Free Developer":
        raise HTTPException(status_code=400, detail="Already on Free tier")

    current_user.subscription_tier = "Free Developer"
    db.commit()
    
    await billing_events.broadcast(current_user.id, {"tier": current_user.subscription_tier, "is_active": current_user.is_active})
    
    return {"success": True, "message": "Successfully downgraded to Free Developer"}

@router.get("/stream")
async def billing_stream(request: Request, token: str = Query(None), db: Session = Depends(get_db)):
    """
    SSE stream for real-time tier and status updates.
    """
    if not token:
        raise HTTPException(status_code=401, detail="Authentication token required")
    from app.api.dependencies import get_current_user
    try:
        user = get_current_user(token=token, db=db)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    async def event_generator():
        q = billing_events.connect(user.id)
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            billing_events.disconnect(user.id, q)
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")
