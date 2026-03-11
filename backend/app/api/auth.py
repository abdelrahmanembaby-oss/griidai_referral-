from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from sqlalchemy import select
from ..core.db import get_db
from ..schemas.user import UserCreate, UserOut
from ..schemas.auth import LoginRequest, AuthResponse
from ..services.referral_service import create_user
from ..models.user import User
from ..core.security import create_access_token, verify_password
from ..core.config import settings

from authlib.integrations.starlette_client import OAuth
import uuid

router = APIRouter(tags=["auth"])

oauth = OAuth()
if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
    oauth.register(
        name="google",
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        client_kwargs={"scope": "openid email profile"},
    )


@router.post("/auth/signup", response_model=AuthResponse)
async def signup(user_in: UserCreate, request: Request, db: AsyncSession = Depends(get_db)):
    # email uniqueness check
    existing = await db.execute(
        select(User).where(User.email == user_in.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    if not user_in.password:
        raise HTTPException(status_code=400, detail="Password is required")
    user = await create_user(
        db,
        email=user_in.email,
        password=user_in.password,
        referral_code=user_in.referral_code,
        device_fp=user_in.device_fingerprint,
        ip_address=str(request.client.host) if request.client else None,
    )
    token = create_access_token(str(user.id))
    return AuthResponse(access_token=token, user=user)


@router.post("/auth/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.email == payload.email))
    user = res.scalar_one_or_none()
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token(str(user.id))
    return AuthResponse(access_token=token, user=user)


@router.get("/me", response_model=UserOut)
async def me(request: Request, db: AsyncSession = Depends(get_db)):
    auth_header = request.headers.get("authorization") or ""
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = auth_header.split(" ", 1)[1]
    try:
        from ..core.security import decode_token

        user_id = decode_token(token).get("sub")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    try:
        user_uuid = uuid.UUID(str(user_id))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    res = await db.execute(select(User).where(User.id == user_uuid))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.get("/auth/google/start")
async def google_start(request: Request, ref: Optional[str] = None):
    if not getattr(oauth, "google", None):
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    # encode referral code inside state for "first-ref-wins" attribution on signup
    state = ref or ""
    redirect_uri = settings.GOOGLE_REDIRECT_URL
    return await oauth.google.authorize_redirect(request, redirect_uri, state=state)


@router.get("/auth/google/callback")
async def google_callback(request: Request, db: AsyncSession = Depends(get_db)):
    if not getattr(oauth, "google", None):
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo")
    if not userinfo:
        userinfo = await oauth.google.userinfo(token=token)

    google_sub = userinfo.get("sub")
    email = userinfo.get("email")
    if not google_sub or not email:
        raise HTTPException(status_code=400, detail="Google userinfo missing fields")

    # if user exists by google_sub or email, reuse it; else create
    res = await db.execute(select(User).where((User.google_sub == google_sub) | (User.email == email)))
    user = res.scalar_one_or_none()
    if not user:
        # state carries ref code
        ref_code = (request.query_params.get("state") or "").strip() or None
        user = await create_user(db, email=email, google_sub=google_sub, referral_code=ref_code)
    else:
        # ensure google_sub linked
        if not user.google_sub:
            user.google_sub = google_sub
            await db.commit()
            await db.refresh(user)

    jwt_token = create_access_token(str(user.id))
    # redirect back to frontend with token (dev-friendly). In production use httpOnly cookies.
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/signup?token={jwt_token}",
        status_code=302,
    )
