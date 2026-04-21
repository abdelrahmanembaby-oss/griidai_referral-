from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    referral_code: Optional[str] = None
    device_fingerprint: Optional[str] = None


class UserOut(BaseModel):
    id: str
    email: str
    referral_code: str
    referred_by_user_id: Optional[str] = None
    plan_type: str
    total_credits: str
    created_at: datetime

    class Config:
        from_attributes = True
