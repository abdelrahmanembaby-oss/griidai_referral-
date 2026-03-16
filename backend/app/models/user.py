import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..core.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    referral_code = Column(String, unique=True, index=True, nullable=False)
    referred_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    total_credits = Column(String, default="0")
    plan_type = Column(String, default="free")
    device_fingerprint = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    referrals = relationship("Referral", back_populates="referrer", foreign_keys='Referral.referrer_user_id')
    referred = relationship("Referral", back_populates="referred", foreign_keys='Referral.referred_user_id')
