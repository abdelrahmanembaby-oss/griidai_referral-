// GriidAi Referral Program Types

export interface User {
  id: string;
  email: string;
  name: string;
  organization_id: string;
  organization_name: string;
  plan_type: 'free' | 'pro' | 'enterprise';
  total_credits: number;
  referral_code: string;
  referred_by_user_id?: string;
  ip_address?: string;
  created_at: string;
  credits_expiry_date?: string;
}

export type ReferralStatus = 
  | 'pending' 
  | 'signed_up' 
  | 'verified' 
  | 'qualified' 
  | 'rewarded' 
  | 'rejected';

export interface Referral {
  id: string;
  referrer_user_id: string;
  referred_user_id?: string;
  referred_user?: User;
  status: ReferralStatus;
  reward_granted: boolean;
  reward_type?: '1_week_pro' | '50_credits' | '1_month_pro' | 'early_access';
  created_at: string;
  qualified_at?: string;
  suspicious_flags?: string[];
}

export interface ReferralRewardLog {
  id: string;
  user_id: string;
  referral_id: string;
  credits_added: number;
  reward_type: string;
  created_at: string;
}

export interface ReferralTier {
  referrals: number;
  reward: string;
  description: string;
  icon: string;
}

export interface ReferralStats {
  total_invited: number;
  signed_up: number;
  qualified: number;
  rewarded: number;
  current_tier: number;
  next_tier_referrals: number;
  total_credits_earned: number;
}

export interface AbuseFlag {
  type: 'same_ip' | 'same_device' | 'same_domain' | 'temp_email' | 'self_referral';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface AdminStats {
  total_referrals_this_month: number;
  conversion_rate: number;
  top_referrers: { user: User; referral_count: number }[];
  suspicious_clusters: { flag: string; count: number }[];
  abuse_detection_flags: number;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'signup' | 'qualified' | 'reward_earned';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}
