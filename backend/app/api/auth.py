from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..core.db import get_db
from ..core.security import hash_password, verify_password, create_access_token
from ..core.auth import get_current_user
from ..schemas.user import UserCreate, UserOut
from ..schemas.auth import AuthResponse
from ..services.referral_service import create_user
from ..models.user import User

router = APIRouter(tags=["auth"])


@router.post("/auth/signup", response_model=AuthResponse)
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
        password=user_in.password,
        referral_code=user_in.referral_code,
        device_fp=user_in.device_fingerprint,
        ip_address=str(request.client.host) if request.client else None,
    )

    token = create_access_token(subject=str(user.id))
    return AuthResponse(
        access_token=token,
        user=UserOut.model_validate(user),
    )


@router.post("/auth/login", response_model=AuthResponse)
async def login(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()
    email = body.get("email", "")
    password = body.get("password", "")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(subject=str(user.id))
    return AuthResponse(
        access_token=token,
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
