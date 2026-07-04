import os
import httpx
import logging

logger = logging.getLogger(__name__)

async def send_password_reset_email(to_email: str, reset_token: str):
    """
    Sends a password reset email using the Resend API (3K emails/mo free).
    Falls back to a console log if RESEND_API_KEY is missing (graceful no-op).
    See: https://resend.com/docs/api-reference/emails/send-email
    """
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"

    resend_api_key = os.environ.get("RESEND_API_KEY")

    if not resend_api_key:
        # Dev / unconfigured — log the link so it can be used manually
        logger.warning(f"[Mock Email] Password reset for {to_email} → {reset_link}")
        return

    html_body = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0f0f17; border-radius: 12px; border: 1px solid #2a2a3a;">
      <h2 style="color: #c084fc; margin-top: 0;">AgenticForge Password Reset</h2>
      <p style="color: #a1a1b5;">We received a request to reset the password for your account.</p>
      <a href="{reset_link}"
         style="display: inline-block; margin: 24px 0; padding: 12px 28px; background: #7c3aed; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
        Reset My Password
      </a>
      <p style="color: #6b7280; font-size: 13px;">This link expires in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.</p>
      <hr style="border-color: #2a2a3a; margin: 24px 0;" />
      <p style="color: #4b5563; font-size: 12px;">AgenticForge · Multi-Agent Code Generation Studio</p>
    </div>
    """

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": "AgenticForge <noreply@agenticforge.dev>",
                    "to": [to_email],
                    "subject": "Reset Your AgenticForge Password",
                    "html": html_body,
                },
                timeout=10.0,
            )
            response.raise_for_status()
            logger.info(f"Password reset email sent to {to_email} via Resend (id={response.json().get('id')})")
    except Exception as e:
        logger.error(f"Failed to send Resend email to {to_email}: {e}")

