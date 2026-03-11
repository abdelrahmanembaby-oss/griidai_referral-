from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr
import uuid


class UserCreate(BaseModel):
    email: EmailStr
    password: Optional[str] = None
    referral_code: Optional[str] = None
    device_fingerprint: Optional[str] = None
    ip_address: Optional[str] = None


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    referral_code: str
    referred_by_user_id: Optional[uuid.UUID]
    plan_type: str
    total_credits: str
    created_at: datetime

    model_config = {"from_attributes": True}
