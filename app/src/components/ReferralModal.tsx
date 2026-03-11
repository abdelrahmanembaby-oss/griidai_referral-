import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/api/client';
import { toast } from 'sonner';
import { Copy, Link as LinkIcon, X, Gift, Trophy, Star, Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Tier = {
  key: string;
  referrals: number;
  reward: string;
  unlocked: boolean;
  progress: number;
};

type ReferralMe = {
  referral_code: string;
  referral_link: string;
  referral_count: number;
  tiers: Tier[];
};

type ReferralModalProps = {
  open: boolean;
  onClose: () => void;
};

const TIER_ICONS = [Gift, Star, Trophy, Zap];

export function ReferralModal({ open, onClose }: ReferralModalProps) {
  const { token, user } = useAuth();
  const [data, setData] = useState<ReferralMe | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'rewards' | 'invite'>('rewards');

  const tiers = useMemo<Tier[]>(
    () =>
      data?.tiers || [
        { key: 'tier_1', referrals: 1, reward: '1 week Pro', unlocked: false, progress: 0 },
        { key: 'tier_3', referrals: 3, reward: '$50 credits', unlocked: false, progress: 0 },
        { key: 'tier_5', referrals: 5, reward: '1 month Pro', unlocked: false, progress: 0 },
        { key: 'tier_10', referrals: 10, reward: 'Early feature access badge', unlocked: false, progress: 0 },
      ],
    [data]
  );

  useEffect(() => {
    if (!open || !token) return;
    const run = async () => {
      setLoading(true);
      try {
        const me = await apiFetch<ReferralMe>('/api/referral/me', { token });
        setData(me);
      } catch {
        toast.error('Failed to load referral data');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [open, token]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="referral-modal" showCloseButton={false}>
        {/* Custom close button */}
        <button className="referral-modal-close" onClick={onClose}>
          <X size={18} />
        </button>

        <DialogHeader>
          <DialogTitle className="referral-modal-title">
            <Gift size={22} className="text-[#2b8a8a]" />
            Referral Program
          </DialogTitle>
          <p className="referral-modal-subtitle">
            Your referrals: <strong>{data?.referral_count ?? '—'}</strong>
          </p>
        </DialogHeader>

        {/* Tabs */}
        <div className="referral-tabs">
          <button
            className={`referral-tab ${tab === 'rewards' ? 'referral-tab--active' : ''}`}
            onClick={() => setTab('rewards')}
          >
            Rewards
          </button>
          <button
            className={`referral-tab ${tab === 'invite' ? 'referral-tab--active' : ''}`}
            onClick={() => setTab('invite')}
          >
            Invite
          </button>
        </div>

        {/* --- Rewards Tab --- */}
        {tab === 'rewards' && (
          <div className="referral-rewards">
            {tiers.map((t, i) => {
              const Icon = TIER_ICONS[i] || Gift;
              const count = data?.referral_count ?? 0;
              const pct = Math.min((count / t.referrals) * 100, 100);
              return (
                <div
                  key={t.key}
                  className={`referral-reward-card ${t.unlocked ? 'referral-reward-card--unlocked' : ''}`}
                >
                  <div className="referral-reward-icon">
                    <Icon size={20} />
                  </div>
                  <div className="referral-reward-info">
                    <div className="referral-reward-name">{t.reward}</div>
                    <div className="referral-reward-req">{t.referrals} referral{t.referrals > 1 ? 's' : ''} needed</div>
                    <div className="referral-reward-bar-wrap">
                      <div className="referral-reward-bar">
                        <div
                          className="referral-reward-bar-fill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="referral-reward-status">
                        {t.unlocked ? '✓ Unlocked' : `${Math.min(count, t.referrals)}/${t.referrals}`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {loading && <div className="text-xs text-gray-400 mt-2">Loading…</div>}
          </div>
        )}

        {/* --- Invite Tab --- */}
        {tab === 'invite' && (
          <div className="referral-invite">
            {!token || !user ? (
              <div className="referral-invite-signin">
                <p>You need to sign in to get your personal referral link.</p>
                <button className="referral-signin-btn" onClick={onClose}>
                  Go to signup
                </button>
              </div>
            ) : (
              <>
                <p className="referral-invite-desc">
                  Share this link. When someone signs up, you'll get credit automatically.
                </p>
                <div className="referral-invite-link-row">
                  <input
                    readOnly
                    value={data?.referral_link ?? ''}
                    className="referral-invite-input"
                  />
                  <button
                    className="referral-copy-btn"
                    onClick={async () => {
                      const link = data?.referral_link;
                      if (!link) return;
                      await navigator.clipboard.writeText(link);
                      toast.success('Link copied!');
                    }}
                  >
                    <Copy size={16} />
                    Copy
                  </button>
                </div>
                <div className="referral-invite-code">
                  <LinkIcon size={14} />
                  Referral code: <code>{data?.referral_code}</code>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
