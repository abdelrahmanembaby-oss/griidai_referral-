"""Optional Redis client – the app works without Redis running."""

_redis = None


async def get_redis():
    """Lazily connect to Redis. Returns None if Redis is unavailable."""
    global _redis
    if _redis is not None:
        return _redis
    try:
        import aioredis
        from .config import settings
        _redis = aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
        await _redis.ping()
        return _redis
    except Exception:
        _redis = None
        return None
