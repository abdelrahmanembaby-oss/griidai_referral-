from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class ReferralStatus(str, Enum):
    pending = "pending"
    signed_up = "signed_up"
    verified = "verified"
    qualified = "qualified"
    rewarded = "rewarded"
    rejected = "rejected"


class ReferralCreate(BaseModel):
    referrer_user_id: str
    referred_user_id: str


class ReferralOut(BaseModel):
    id: str
    referrer_user_id: str
    referred_user_id: str
    status: ReferralStatus
    reward_granted: bool
    reward_type: Optional[str] = None
    created_at: datetime
    qualified_at: Optional[datetime] = None

    class Config:
        from_attributes = True
