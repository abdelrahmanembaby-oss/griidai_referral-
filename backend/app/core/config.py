import os
from dotenv import load_dotenv
from typing import Optional

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env"))


class Settings:
    API_PREFIX: str = os.environ.get("API_PREFIX", "/api")
    PROJECT_NAME: str = os.environ.get("PROJECT_NAME", "GriidAi Referral System")

    # Prefer Postgres in production; default to local SQLite for zero-setup dev.
    DATABASE_URL: str = os.environ.get(
        "DATABASE_URL",
        "sqlite+aiosqlite:///./griidai.db",
    )
    REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

    SECRET_KEY: str = os.environ.get("SECRET_KEY", "changeme")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = os.environ.get("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: Optional[str] = os.environ.get("GOOGLE_CLIENT_SECRET")
    GOOGLE_REDIRECT_URL: str = os.environ.get(
        "GOOGLE_REDIRECT_URL",
        "http://localhost:8000/api/auth/google/callback",
    )

    # Frontend app URL for redirects
    FRONTEND_URL: str = os.environ.get("FRONTEND_URL", "http://localhost:5173")


settings = Settings()

# Normalize common shorthand values (e.g. "file:./dev.db") into SQLAlchemy URLs.
if settings.DATABASE_URL.startswith("file:"):
    path = settings.DATABASE_URL[len("file:") :]
    # Ensure relative paths remain relative to working directory.
    if path.startswith("./"):
        settings.DATABASE_URL = f"sqlite+aiosqlite:///{path}"
    else:
        settings.DATABASE_URL = f"sqlite+aiosqlite:///{path.lstrip('/')}"
