import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Copy, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

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

export function ReferralPage() {
  const { token, user } = useAuth();
  const [data, setData] = useState<ReferralMe | null>(null);
  const [loading, setLoading] = useState(false);

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
    const run = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const me = await apiFetch<ReferralMe>('/api/referral/me', { token });
        setData(me);
      } catch (e: any) {
        toast.error('Failed to load referral data');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [token]);

  if (!token || !user) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Referral Program</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600">
            <div>You need to sign in to get your personal referral link.</div>
            <Button asChild className="bg-gradient-to-r from-[#7c5cff] to-[#7337ff] text-white">
              <Link to="/signup">Go to signup</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <Tabs defaultValue="rewards" className="w-full">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">Referral Program</div>
            <div className="text-sm text-gray-500">
              Your referrals: <span className="font-medium text-gray-900">{data?.referral_count ?? '—'}</span>
            </div>
          </div>
          <TabsList>
            <TabsTrigger value="rewards">Rewards</TabsTrigger>
            <TabsTrigger value="invite">Invite</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="rewards">
          <Card>
            <CardHeader>
              <CardTitle>Tiered Rewards</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-2 pr-4">Referrals</th>
                      <th className="py-2 pr-4">Reward</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((t) => (
                      <tr key={t.key} className="border-b last:border-b-0">
                        <td className="py-3 pr-4 font-medium">{t.referrals}</td>
                        <td className="py-3 pr-4">{t.reward}</td>
                        <td className="py-3">
                          {t.unlocked ? (
                            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                              Unlocked
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">
                              {Math.min(data?.referral_count ?? 0, t.referrals)}/{t.referrals}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {loading && <div className="mt-3 text-xs text-gray-500">Loading…</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invite">
          <Card>
            <CardHeader>
              <CardTitle>Invite link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-gray-600">
                Share this link. When someone signs up, you’ll get credit automatically.
              </div>
              <div className="flex gap-2">
                <Input readOnly value={data?.referral_link ?? ''} className="h-12" />
                <Button
                  variant="outline"
                  className="h-12"
                  onClick={async () => {
                    const link = data?.referral_link;
                    if (!link) return;
                    await navigator.clipboard.writeText(link);
                    toast.success('Copied');
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <LinkIcon className="h-3.5 w-3.5" />
                Referral code: <span className="font-mono text-gray-800">{data?.referral_code}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

