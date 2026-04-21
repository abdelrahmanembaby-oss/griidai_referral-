from datetime import datetime, timedelta
from typing import Optional, List
import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user import User
from ..models.referral import Referral
from ..models.reward_log import ReferralRewardLog
from ..schemas.stats import ReferralStats
from .anti_abuse import is_suspicious
from ..core.security import hash_password
from ..core.config import settings


TIERS = [
    {"referrals": 1, "reward": "1 week Pro", "key": "tier_1"},
    {"referrals": 3, "reward": "$50 credits", "key": "tier_3"},
    {"referrals": 5, "reward": "1 month Pro", "key": "tier_5"},
    {"referrals": 10, "reward": "Early feature access badge", "key": "tier_10"},
]


def compute_tiers(referral_count: int):
    result = []
    for tier in TIERS:
        unlocked = referral_count >= tier["referrals"]
        progress = min(referral_count / tier["referrals"], 1.0) * 100
        result.append({
            "key": tier["key"],
            "referrals": tier["referrals"],
            "reward": tier["reward"],
            "unlocked": unlocked,
            "progress": progress,
        })
    return result


async def create_user(
    session: AsyncSession,
    email: str,
    password: Optional[str] = None,
    referral_code: Optional[str] = None,
    device_fp: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> User:
    # generate referral code for the new user
    code = uuid.uuid4().hex[:6].upper()
    referred_by = None

    if referral_code:
        stmt = select(User).where(User.referral_code == referral_code)
        res = await session.execute(stmt)
        referrer = res.scalar_one_or_none()
        if referrer:
            # block self-referral
            if referrer.email.lower() == email.lower():
                referred_by = None
            elif is_suspicious(referrer, email, ip_address, device_fp):
                # still create user but skip referral attribution
                referred_by = None
            else:
                referred_by = str(referrer.id)

    pw_hash = hash_password(password) if password else None

    new_user = User(
        email=email,
        password_hash=pw_hash,
        referral_code=code,
        referred_by_user_id=referred_by,
        device_fingerprint=device_fp,
        ip_address=ip_address,
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)

    # if someone referred, create referral row
    if referred_by:
        referral = Referral(
            referrer_user_id=referred_by,
            referred_user_id=str(new_user.id),
            status="signed_up",
        )
        session.add(referral)
        await session.commit()

    return new_user


async def get_referral_link(user: User) -> str:
    base = (settings.FRONTEND_URL or "http://localhost:5173").rstrip("/")
    return f"{base}/signup?ref={user.referral_code}"


async def get_stats(user_id: str, session: AsyncSession) -> ReferralStats:
    total = await session.scalar(
        select(func.count(Referral.id)).where(Referral.referrer_user_id == user_id)
    ) or 0
    signed = await session.scalar(
        select(func.count(Referral.id)).where(
            Referral.referrer_user_id == user_id,
            Referral.status.in_(["signed_up", "verified", "qualified", "rewarded"]),
        )
    ) or 0
    qualified = await session.scalar(
        select(func.count(Referral.id)).where(
            Referral.referrer_user_id == user_id,
            Referral.status == "qualified",
        )
    ) or 0
    rewarded = await session.scalar(
        select(func.count(Referral.id)).where(
            Referral.referrer_user_id == user_id,
            Referral.status == "rewarded",
        )
    ) or 0

    next_tier = "3 referrals for $50 credits"
    progress = (qualified / 3 * 100) if qualified < 3 else 100.0

    return ReferralStats(
        total_invited=total,
        signed_up=signed,
        qualified=qualified,
        rewards_earned=rewarded,
        next_reward_tier=next_tier,
        progress_percent=progress,
    )


async def list_referrals(user_id: str, session: AsyncSession):
    stmt = select(Referral).where(Referral.referrer_user_id == user_id)
    res = await session.execute(stmt)
    return res.scalars().all()


async def get_referral_history(user_id: str, session: AsyncSession) -> List[dict]:
    stmt = (
        select(Referral, User)
        .join(User, User.id == Referral.referred_user_id)
        .where(Referral.referrer_user_id == user_id)
        .order_by(Referral.created_at.desc())
    )
    res = await session.execute(stmt)
    rows = res.all()
    return [
        {
            "referral_id": str(ref.id),
            "invitee_email": user.email,
            "status": ref.status,
            "created_at": ref.created_at.isoformat() if ref.created_at else None,
        }
        for ref, user in rows
    ]


async def qualification_check(session: AsyncSession, referral: Referral):
    rules_met = True
    if rules_met and referral.status != "qualified":
        referral.status = "qualified"
        referral.qualified_at = datetime.utcnow()
        await session.commit()
        await session.refresh(referral)
