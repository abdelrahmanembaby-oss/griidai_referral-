import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from ..core.db import Base


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    referrer_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    referred_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    status = Column(String, default="pending")
    reward_granted = Column(Boolean, default=False)
    reward_type = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    qualified_at = Column(DateTime, nullable=True)

    referrer = relationship("User", back_populates="referrals", foreign_keys=[referrer_user_id])
    referred = relationship("User", back_populates="referred", foreign_keys=[referred_user_id])
