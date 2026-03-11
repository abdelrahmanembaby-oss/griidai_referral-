from datetime import datetime, timedelta
from typing import Optional
import uuid

from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user import User
from ..models.referral import Referral
from ..models.reward_log import ReferralRewardLog
from ..schemas.stats import ReferralStats
from .anti_abuse import is_suspicious
from ..core.db import AsyncSessionLocal
from ..core.security import hash_password
from ..core.config import settings


async def _generate_unique_referral_code(session: AsyncSession) -> str:
    # 6 chars is convenient, but we still need a uniqueness loop.
    for _ in range(20):
        code = uuid.uuid4().hex[:6].upper()
        existing = await session.execute(select(User.id).where(User.referral_code == code))
        if not existing.scalar_one_or_none():
            return code
    # fallback: longer code if unlucky collisions
    return uuid.uuid4().hex[:10].upper()


async def create_user(
    session: AsyncSession,
    email: str,
    password: Optional[str] = None,
    google_sub: Optional[str] = None,
    referral_code: Optional[str] = None,
    device_fp: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> User:
    code = await _generate_unique_referral_code(session)
    referred_by = None
    if referral_code:
        stmt = select(User).where(User.referral_code == referral_code)
        res = await session.execute(stmt)
        referrer = res.scalar_one_or_none()
        if referrer:
            # block self-referral
            if referrer.email.lower() == email.lower():
                referred_by = None
            else:
                # anti-abuse check
                if is_suspicious(referrer, email, ip_address, device_fp):
                    # create user but keep attribution; higher-level logic can reject/flag later
                    referred_by = referrer.id
                else:
                    referred_by = referrer.id
        else:
            referred_by = None

    new_user = User(
        email=email,
        password_hash=hash_password(password) if password else None,
        google_sub=google_sub,
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
            referred_user_id=new_user.id,
            status="signed_up",
        )
        session.add(referral)
        await session.commit()
    return new_user


async def get_referral_link(user: User) -> str:
    base = (settings.FRONTEND_URL or "https://app.griidai.com").rstrip("/")
    return f"{base}/signup?ref={user.referral_code}"


try:
    from ..core.redis_client import redis  # type: ignore
except Exception:  # pragma: no cover
    redis = None  # type: ignore


async def get_stats(user_id: str, session: AsyncSession) -> ReferralStats:
    cache_key = f"referral_stats:{user_id}"
    if redis is not None:
        try:
            cached = await redis.get(cache_key)
            if cached:
                return ReferralStats.model_validate_json(cached)
        except Exception:
            pass

    total = await session.scalar(
        select(func.count(Referral.id)).where(Referral.referrer_user_id == user_id)
    )
    signed = await session.scalar(
        select(func.count(Referral.id)).where(
            Referral.referrer_user_id == user_id,
            Referral.status.in_(["signed_up", "verified", "qualified", "rewarded"]),
        )
    )
    qualified = await session.scalar(
        select(func.count(Referral.id)).where(
            Referral.referrer_user_id == user_id,
            Referral.status == "qualified",
        )
    )
    rewarded = await session.scalar(
        select(func.count(Referral.id)).where(
            Referral.referrer_user_id == user_id,
            Referral.status == "rewarded",
        )
    )
    # progress to next tier
    next_tier = "3 referrals for $50 credits"
    progress = (qualified / 3 * 100) if qualified < 3 else 100
    stats = ReferralStats(
        total_invited=total or 0,
        signed_up=signed or 0,
        qualified=qualified or 0,
        rewards_earned=rewarded or 0,
        next_reward_tier=next_tier,
        progress_percent=progress,
    )
    if redis is not None:
        try:
            await redis.set(cache_key, stats.model_dump_json(), ex=300)  # cache 5 minutes
        except Exception:
            pass
    return stats


TIERS = [
    {"referrals": 1, "reward": "1 week Pro", "key": "tier_1"},
    {"referrals": 3, "reward": "$50 credits", "key": "tier_3"},
    {"referrals": 5, "reward": "1 month Pro", "key": "tier_5"},
    {"referrals": 10, "reward": "Early feature access badge", "key": "tier_10"},
]


def compute_tiers(referral_count: int):
    tiers = []
    for t in TIERS:
        tiers.append(
            {
                **t,
                "unlocked": referral_count >= t["referrals"],
                "progress": min(referral_count, t["referrals"]),
            }
        )
    return tiers


async def list_referrals(user_id: str, session: AsyncSession):
    stmt = select(Referral).where(Referral.referrer_user_id == user_id)
    res = await session.execute(stmt)
    return res.scalars().all()


async def qualification_check(session: AsyncSession, referral: Referral):
    # called when triggering project create or compute run or verification
    user_stmt = select(User).where(User.id == referral.referred_user_id)
    res = await session.execute(user_stmt)
    user = res.scalar_one()

    rules_met = True
    # sample checks: You'd store flags on user table or separate table, skipping actual implementation
    # For now assume external triggers mark referral.status accordingly
    if rules_met and referral.status != "qualified":
        referral.status = "qualified"
        referral.qualified_at = datetime.utcnow()
        await session.commit()
        await session.refresh(referral)
