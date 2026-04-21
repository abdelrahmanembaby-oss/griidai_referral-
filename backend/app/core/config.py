import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env"), override=True)


class Settings:
    DATABASE_URL: str = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./dev.db")
    REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    API_PREFIX: str = "/api"
    PROJECT_NAME: str = "GriidAi Referral System"
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "changeme")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    FRONTEND_URL: str = os.environ.get("FRONTEND_URL", "http://localhost:5173")


settings = Settings()
