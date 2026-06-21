from pydantic import BaseModel, EmailStr
from typing import Optional

class BillingStatusResponse(BaseModel):
    subscription_tier: str
    is_active: bool

class CheckoutRequest(BaseModel):
    tier_id: str

class CheckoutResponse(BaseModel):
    checkout_url: str

class WebhookPayload(BaseModel):
    email: EmailStr
    tier_id: str
    status: str
