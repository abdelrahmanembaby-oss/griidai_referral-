import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from ..core.db import Base


class ReferralRewardLog(Base):
    __tablename__ = "referral_reward_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    referral_id = Column(String(36), ForeignKey("referrals.id"), nullable=False)
    credits_added = Column(String, nullable=True)
    reward_type = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expiry_date = Column(DateTime, nullable=True)

    user = relationship("User")
    referral = relationship("Referral")
