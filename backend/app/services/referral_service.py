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


async def create_user(session: AsyncSession, email: str, referral_code: Optional[str] = None,
                      device_fp: Optional[str] = None, ip_address: Optional[str] = None) -> User:
    # generate referral code
    code = uuid.uuid4().hex[:6].upper()
    referred_by = None
    if referral_code:
        stmt = select(User).where(User.referral_code == referral_code)
        res = await session.execute(stmt)
        referrer = res.scalar_one_or_none()
        if referrer:
            # anti-abuse check
            if is_suspicious(referrer, email, ip_address, device_fp):
                # create user but mark referral rejected later
                referred_by = referrer.id
            else:
                referred_by = referrer.id
        else:
            referred_by = None

    new_user = User(
        email=email,
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
    return f"https://app.griidai.com/signup?ref={user.referral_code}"


from ..core.redis_client import redis


async def get_stats(user_id: str, session: AsyncSession) -> ReferralStats:
    cache_key = f"referral_stats:{user_id}"
    cached = await redis.get(cache_key)
    if cached:
        return ReferralStats.parse_raw(cached)

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
    await redis.set(cache_key, stats.json(), ex=300)  # cache 5 minutes
    return stats


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
