from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from sqlalchemy import select, func
from ..core.db import get_db
from ..core.auth import get_current_user
from ..services import referral_service
from ..schemas import stats as stats_schema
from ..schemas.referral import ReferralOut
from ..schemas.referral_history import ReferralHistoryItem
from ..models.referral import Referral
from ..models.user import User

router = APIRouter(prefix="/referral", tags=["referral"])

@router.get("/link")
async def get_link(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user_stmt = await db.execute(
        select(User).where(User.id == current_user.id)
    )
    user = user_stmt.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return {"link": await referral_service.get_referral_link(user)}


@router.get("/validate")
async def validate(code: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.referral_code == code))
    user = res.scalar_one_or_none()
    return {"valid": bool(user)}


@router.get("/me")
async def me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # count referrals credited on signup
    referral_count = await db.scalar(
        select(func.count(Referral.id)).where(Referral.referrer_user_id == current_user.id)
    )
    referral_count = int(referral_count or 0)
    tiers = referral_service.compute_tiers(referral_count)
    return {
        "referral_code": current_user.referral_code,
        "referral_link": await referral_service.get_referral_link(current_user),
        "referral_count": referral_count,
        "tiers": tiers,
    }


@router.get("/stats", response_model=stats_schema.ReferralStats)
async def stats(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await referral_service.get_stats(str(current_user.id), db)


@router.get("/list", response_model=List[ReferralOut])
async def list_referrals(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    refs = await referral_service.list_referrals(str(current_user.id), db)
    return refs


@router.get("/history", response_model=List[ReferralHistoryItem])
async def history(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Referral, User.email)
        .join(User, User.id == Referral.referred_user_id)
        .where(Referral.referrer_user_id == current_user.id)
        .order_by(Referral.created_at.desc())
        .limit(100)
    )
    res = await db.execute(stmt)
    items: List[ReferralHistoryItem] = []
    for referral, email in res.all():
        items.append(
            ReferralHistoryItem(
                referral_id=str(referral.id),
                invitee_email=email,
                status=referral.status,
                created_at=referral.created_at,
            )
        )
    return items
