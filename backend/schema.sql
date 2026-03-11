-- PostgreSQL schema for GriidAi referral system

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    referral_code TEXT UNIQUE NOT NULL,
    referred_by_user_id UUID REFERENCES users(id),
    total_credits TEXT DEFAULT '0',
    plan_type TEXT DEFAULT 'free',
    device_fingerprint TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_user_id UUID NOT NULL REFERENCES users(id),
    referred_user_id UUID NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    reward_granted BOOLEAN DEFAULT FALSE,
    reward_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    qualified_at TIMESTAMPTZ
);

CREATE TABLE referral_reward_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    referral_id UUID NOT NULL REFERENCES referrals(id),
    credits_added TEXT,
    reward_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    expiry_date TIMESTAMPTZ
);
