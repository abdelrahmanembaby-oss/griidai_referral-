from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    referral_code: Optional[str]
    device_fingerprint: Optional[str]
    ip_address: Optional[str]


class UserOut(BaseModel):
    id: str
    email: EmailStr
    referral_code: str
    referred_by_user_id: Optional[str]
    plan_type: str
    total_credits: str
    created_at: datetime

    class Config:
        orm_mode = True
