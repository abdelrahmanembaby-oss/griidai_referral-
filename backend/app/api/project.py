from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select
from ..core.db import get_db
from ..models.referral import Referral
from ..services.referral_service import qualification_check

router = APIRouter(tags=["project"])


@router.post("/project/create")
async def project_create(referral_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Referral).where(Referral.id == referral_id)
    res = await db.execute(stmt)
    referral = res.scalar_one_or_none()
    if referral:
        # call qualification check which might update status
        await qualification_check(db, referral)
    return {"status": "ok"}
