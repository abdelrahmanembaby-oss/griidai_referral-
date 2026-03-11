import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy import Uuid
from sqlalchemy.orm import relationship

from ..core.db import Base


class ReferralRewardLog(Base):
    __tablename__ = "referral_reward_logs"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    referral_id = Column(Uuid(as_uuid=True), ForeignKey("referrals.id"), nullable=False)
    credits_added = Column(String, nullable=True)
    reward_type = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expiry_date = Column(DateTime, nullable=True)

    user = relationship("User")
    referral = relationship("Referral")
