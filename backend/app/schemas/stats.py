from pydantic import BaseModel


class ReferralStats(BaseModel):
    total_invited: int
    signed_up: int
    qualified: int
    rewards_earned: int
    next_reward_tier: str
    progress_percent: float
