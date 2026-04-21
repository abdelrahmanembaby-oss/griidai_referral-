from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from sqlalchemy import select, func
from ..core.db import get_db
from ..core.auth import get_current_user
from ..services import referral_service
from ..schemas.referral import ReferralOut
from ..schemas.referral_history import ReferralHistoryItem
from ..models.referral import Referral
from ..models.user import User

router = APIRouter(prefix="/referral", tags=["referral"])


@router.get("/link")
async def get_link(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return {"link": await referral_service.get_referral_link(current_user)}


@router.get("/validate")
async def validate_code(
    code: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.referral_code == code))
    user = result.scalar_one_or_none()
    return {"valid": user is not None}


@router.get("/me")
async def referral_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Count referrals
    count_result = await db.execute(
        select(func.count(Referral.id)).where(
            Referral.referrer_user_id == str(current_user.id)
        )
    )
    referral_count = count_result.scalar() or 0

    tiers = referral_service.compute_tiers(referral_count)
    link = await referral_service.get_referral_link(current_user)

    return {
        "referral_code": current_user.referral_code,
        "referral_link": link,
        "referral_count": referral_count,
        "tiers": tiers,
    }


@router.get("/stats")
async def stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await referral_service.get_stats(str(current_user.id), db)


@router.get("/list", response_model=List[ReferralOut])
async def list_referrals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    refs = await referral_service.list_referrals(str(current_user.id), db)
    return refs


@router.get("/history")
async def referral_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await referral_service.get_referral_history(str(current_user.id), db)
