from datetime import datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.referral import Referral
from ..models.user import User
from ..models.reward_log import ReferralRewardLog


async def process_rewards(session: AsyncSession):
    stmt = select(Referral).where(
        Referral.status == "qualified",
        Referral.reward_granted == False,
    )
    res = await session.execute(stmt)
    referrals = res.scalars().all()
    for r in referrals:
        # calculate reward based on count maybe
        referrer_stmt = select(User).where(User.id == r.referrer_user_id)
        ref_res = await session.execute(referrer_stmt)
        referrer = ref_res.scalar_one()

        # simplistic: always grant 1 week pro
        # update credits & logs
        log = ReferralRewardLog(
            user_id=referrer.id,
            referral_id=r.id,
            credits_added="",  # or amount
            reward_type="1_week_pro",
            expiry_date=datetime.utcnow() + timedelta(days=45),
        )
        session.add(log)
        r.reward_granted = True
        r.status = "rewarded"
        await session.commit()
