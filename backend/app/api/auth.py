from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select
from ..core.db import get_db
from ..schemas.user import UserCreate, UserOut
from ..services.referral_service import create_user
from ..models.user import User

router = APIRouter(tags=["auth"])


@router.post("/signup", response_model=UserOut)
async def signup(user_in: UserCreate, request: Request, db: AsyncSession = Depends(get_db)):
    # email uniqueness check
    existing = await db.execute(
        select(User).where(User.email == user_in.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = await create_user(
        db,
        email=user_in.email,
        referral_code=user_in.referral_code,
        device_fp=user_in.device_fingerprint,
        ip_address=str(request.client.host) if request.client else None,
    )
    return user
