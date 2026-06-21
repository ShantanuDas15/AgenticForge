import os
import httpx
import logging

logger = logging.getLogger(__name__)

async def send_password_reset_email(to_email: str, reset_token: str):
    """
    Sends a password reset email using SendGrid API.
    Falls back to a console log if SENDGRID_API_KEY is missing.
    """
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    
    sendgrid_api_key = os.environ.get("SENDGRID_API_KEY")
    
    if not sendgrid_api_key:
        logger.warning(f"Mock Email to {to_email} | Password Reset Link: {reset_link}")
        return

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {sendgrid_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "personalizations": [{"to": [{"email": to_email}]}],
                    "from": {"email": "noreply@agenticforge.com", "name": "AgenticForge Support"},
                    "subject": "Reset Your AgenticForge Password",
                    "content": [{"type": "text/html", "value": f"<p>We received a request to reset your password.</p><p>Click <a href='{reset_link}'>here</a> to reset it. This link is valid for 1 hour.</p>"}]
                },
                timeout=10.0
            )
            response.raise_for_status()
            logger.info(f"Password reset email dispatched to {to_email} via SendGrid.")
    except Exception as e:
        logger.error(f"Failed to send SendGrid email to {to_email}: {str(e)}")
