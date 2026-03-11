from datetime import datetime
from pydantic import BaseModel, EmailStr


class ReferralHistoryItem(BaseModel):
    referral_id: str
    invitee_email: EmailStr
    status: str
    created_at: datetime

