import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { apiFetch, getApiUrl } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';

const REF_KEY = 'griidai_ref_code';

type AuthResponse = {
  access_token: string;
  token_type: string;
  user: any;
};

export function SignupPageNew() {
  const nav = useNavigate();
  const { setToken } = useAuth();
  const [params] = useSearchParams();
  const refFromUrl = params.get('ref') || '';
  const tokenFromUrl = params.get('token') || '';

  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const refCode = useMemo(() => refFromUrl || localStorage.getItem(REF_KEY) || '', [refFromUrl]);

  useEffect(() => {
    if (refFromUrl) localStorage.setItem(REF_KEY, refFromUrl);
  }, [refFromUrl]);

  useEffect(() => {
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
      toast.success('Signed in with Google');
      nav('/referral');
    }
  }, [tokenFromUrl, setToken, nav]);

  const submit = async () => {
    setLoading(true);
    try {
      if (mode === 'signup') {
        const res = await apiFetch<AuthResponse>('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ email, password, referral_code: refCode || null }),
        });
        setToken(res.access_token);
        toast.success('Account created');
        nav('/referral');
      } else {
        const res = await apiFetch<AuthResponse>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        setToken(res.access_token);
        toast.success('Welcome back');
        nav('/referral');
      }
    } catch (e: any) {
      toast.error('Auth failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="hidden lg:block rounded-2xl border bg-gradient-to-b from-purple-50 to-white p-8">
          <div className="text-sm font-medium text-gray-700">Referral</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">Invite friends, unlock rewards</div>
          <div className="mt-3 text-sm text-gray-600">
            Count on signup. First referral code wins (can’t be changed later).
          </div>
          {refCode ? (
            <div className="mt-6 rounded-xl border bg-white p-4 text-sm">
              Referral code detected:
              <div className="mt-1 font-mono text-gray-900">{refCode}</div>
            </div>
          ) : (
            <div className="mt-6 text-sm text-gray-500">No referral code detected.</div>
          )}
        </div>

        <Card className="border-0 shadow-xl shadow-purple-500/5">
          <CardHeader>
            <CardTitle>{mode === 'signup' ? 'Create account' : 'Sign in'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Password</label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="••••••••"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submit();
                }}
              />
            </div>

            <Button
              disabled={loading || !email || !password}
              onClick={() => void submit()}
              className="w-full h-12 bg-gradient-to-r from-[#7c5cff] to-[#7337ff] text-white"
            >
              {loading ? 'Please wait…' : mode === 'signup' ? 'Sign up' : 'Sign in'}
            </Button>

            <div className="flex items-center justify-between text-sm text-gray-600">
              <button
                className="text-[#7c5cff] font-medium hover:underline"
                onClick={() => setMode((m) => (m === 'signup' ? 'login' : 'signup'))}
              >
                {mode === 'signup' ? 'I already have an account' : 'Create a new account'}
              </button>
              <a
                className="text-gray-600 hover:text-gray-900"
                href={getApiUrl(`/api/auth/google/start${refCode ? `?ref=${encodeURIComponent(refCode)}` : ''}`)}
              >
                Continue with Google
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

