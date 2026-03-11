import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, Referral, ReferralStats, AdminStats, Notification, ReferralRewardLog } from '@/types';
import { currentUser as initialUser, mockReferrals, referralTiers, adminStats as initialAdminStats, mockNotifications } from '@/data/mockData';

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  referrals: Referral[];
  setReferrals: React.Dispatch<React.SetStateAction<Referral[]>>;
  referralStats: ReferralStats;
  adminStats: AdminStats;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  rewardLogs: ReferralRewardLog[];
  approveReferral: (id: string) => void;
  rejectReferral: (id: string) => void;
  markNotificationAsRead: (id: string) => void;
  addReferral: (newReferral: Referral) => void;
  addNotification: (notif: Notification) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser);
  const [referrals, setReferrals] = useState<Referral[]>(mockReferrals);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [rewardLogs, setRewardLogs] = useState<ReferralRewardLog[]>([]);

  // Derived stats from current dynamic state
  const totalInvited = referrals.length;
  const signedUp = referrals.filter(r => r.status === 'signed_up' || r.status === 'qualified' || r.status === 'rewarded' || r.status === 'verified').length;
  const qualified = referrals.filter(r => r.status === 'qualified' || r.status === 'rewarded').length;
  const rewarded = referrals.filter(r => r.status === 'rewarded').length;

  // Calculate credits earned based on actual reward types
  const totalCreditsEarned = referrals
    .filter(r => r.reward_granted && r.reward_type === '50_credits')
    .length * 50;

  // Calculate current Tier based on qualified count and the referralTiers array
  let currentTier = 0;
  for (let i = referralTiers.length - 1; i >= 0; i--) {
    if (qualified >= referralTiers[i].referrals) {
      currentTier = i + 1;
      break;
    }
  }
  const nextTierIndex = currentTier;
  const nextTierReferrals = nextTierIndex < referralTiers.length
    ? referralTiers[nextTierIndex].referrals - qualified
    : 0;

  const referralStats: ReferralStats = {
    total_invited: totalInvited,
    signed_up: signedUp,
    qualified: qualified,
    rewarded: rewarded,
    current_tier: Math.max(1, currentTier),
    next_tier_referrals: Math.max(0, nextTierReferrals),
    total_credits_earned: totalCreditsEarned,
  };

  const adminStats: AdminStats = {
    ...initialAdminStats,
    total_referrals_this_month: totalInvited + 320,
  };

  // Gap 3 fix: Tiered reward logic
  const approveReferral = (id: string) => {
    setReferrals(prev => {
      const referral = prev.find(r => r.id === id);
      if (!referral) return prev;

      // Count how many qualified/rewarded referrals exist for this referrer
      const qualifiedCount = prev.filter(
        r => r.referrer_user_id === referral.referrer_user_id &&
             (r.status === 'qualified' || r.status === 'rewarded')
      ).length + 1; // +1 for this one about to be approved

      // Determine reward type based on tier thresholds
      let rewardType: '1_week_pro' | '50_credits' | '1_month_pro' | 'early_access' = '1_week_pro';
      if (qualifiedCount >= 10) rewardType = 'early_access';
      else if (qualifiedCount >= 5) rewardType = '1_month_pro';
      else if (qualifiedCount >= 3) rewardType = '50_credits';

      return prev.map(r => {
        if (r.id === id) {
          return {
            ...r,
            status: 'rewarded' as const,
            reward_granted: true,
            reward_type: rewardType,
            qualified_at: r.qualified_at || new Date().toISOString(),
          };
        }
        return r;
      });
    });

    // Gap 5 fix: Add reward log entry
    const referral = referrals.find(r => r.id === id);
    if (referral) {
      const newLog: ReferralRewardLog = {
        id: `log_${Date.now()}`,
        user_id: referral.referrer_user_id,
        referral_id: id,
        credits_added: 50,
        reward_type: '50_credits',
        created_at: new Date().toISOString(),
      };
      setRewardLogs(prev => [newLog, ...prev]);
    }
  };

  const rejectReferral = (id: string) => {
    setReferrals(prev => prev.map(r => {
      if (r.id === id) {
        return { ...r, status: 'rejected' as const };
      }
      return r;
    }));
  };

  const addReferral = (newReferral: Referral) => {
    setReferrals(prev => [newReferral, ...prev]);
  };

  const addNotification = (notif: Notification) => {
    setNotifications(prev => [notif, ...prev]);
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      setCurrentUser,
      referrals,
      setReferrals,
      referralStats,
      adminStats,
      notifications,
      setNotifications,
      rewardLogs,
      approveReferral,
      rejectReferral,
      markNotificationAsRead,
      addReferral,
      addNotification,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
