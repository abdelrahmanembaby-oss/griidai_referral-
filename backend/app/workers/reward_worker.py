import asyncio
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.db import AsyncSessionLocal
from ..services.reward_service import process_rewards


async def run_worker(interval: int = 60):
    while True:
        async with AsyncSessionLocal() as session:
            await process_rewards(session)
        await asyncio.sleep(interval)


if __name__ == "__main__":
    asyncio.run(run_worker())
