from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from sqlalchemy import select
from ..core.db import get_db
from ..services import referral_service
from ..schemas import stats as stats_schema
from ..schemas.referral import ReferralOut
from ..models.referral import Referral
from ..models.user import User

router = APIRouter(prefix="/referral", tags=["referral"])


# Dependency stub for current user
async def get_current_user():
    # in production, integrate auth
    class UserObj:
        id = "dummy"
    return UserObj()


@router.get("/link")
async def get_link(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user_stmt = await db.execute(
        select(User).where(User.id == current_user.id)
    )
    user = user_stmt.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return {"link": await referral_service.get_referral_link(user)}


@router.get("/stats", response_model=stats_schema.ReferralStats)
async def stats(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await referral_service.get_stats(current_user.id, db)


@router.get("/list", response_model=List[ReferralOut])
async def list_referrals(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    refs = await referral_service.list_referrals(current_user.id, db)
    return refs
