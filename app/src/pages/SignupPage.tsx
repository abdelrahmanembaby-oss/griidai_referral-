import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Zap, Gift, CheckCircle2, AlertTriangle, Loader2,
  Mail, Lock, Building, User, ArrowRight, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppContext } from '@/contexts/AppContext';

interface SignupPageProps {
  referralCode?: string;
  prefillEmail?: string;
  onNavigate: (page: 'landing' | 'dashboard' | 'signup' | 'admin') => void;
}

export function SignupPage({ referralCode, prefillEmail, onNavigate }: SignupPageProps) {
  const { setCurrentUser, addReferral, addNotification } = useAppContext();
  const [isLogin, setIsLogin] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [referrerName] = useState('Alex Chen');
  const [formData, setFormData] = useState({
    name: '',
    email: prefillEmail || '',
    password: '',
    organization: '',
    agreeTerms: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (referralCode) {
      setIsValidating(true);
      // Simulate validation
      setTimeout(() => {
        setIsValid(true);
        setIsValidating(false);
      }, 1000);
    }
  }, [referralCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLogin && !formData.agreeTerms) {
      toast.error('Please agree to the terms and conditions');
      return;
    }

    setIsSubmitting(true);
    
    // Simulate signup/login
    setTimeout(() => {
      setIsSubmitting(false);
      const newUserId = `user_${Date.now()}`;
      const newUser: any = {
        id: newUserId,
        email: formData.email,
        name: isLogin ? 'Demo User' : formData.name,
        organization_id: 'org_999',
        organization_name: formData.organization || 'My Company',
        plan_type: 'free',
        total_credits: 100,
        referral_code: `GRIIDAI-${(isLogin ? 'DEMO' : formData.name || 'USER').toUpperCase().substring(0,4)}-${Math.random().toString(36).substring(2,7).toUpperCase()}`,
        created_at: new Date().toISOString(),
        referred_by_user_id: (!isLogin && referralCode && isValid) ? 'user_001' : undefined,
      };
      setCurrentUser(newUser);

      // Gap 1: Create referral record when signing up with a valid referral code
      if (!isLogin && referralCode && isValid) {
        addReferral({
          id: `ref_${Date.now()}`,
          referrer_user_id: 'user_001',
          referred_user_id: newUserId,
          referred_user: newUser,
          status: 'signed_up',
          reward_granted: false,
          created_at: new Date().toISOString(),
        });
        // Add notification for the referrer
        addNotification({
          id: `notif_${Date.now()}`,
          user_id: 'user_001',
          type: 'signup',
          title: 'New Referral Signup!',
          message: `${formData.name} just joined GriidAi using your referral link.`,
          read: false,
          created_at: new Date().toISOString(),
        });
      }

      toast.success(isLogin ? 'Welcome back!' : 'Account created successfully!');
      onNavigate('dashboard');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white pt-20 pb-12">
      <div className="w-full px-8 lg:px-16 2xl:px-24">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left Side - Benefits */}
          <div className="hidden lg:block sticky top-24">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 bg-purple-100 text-[#7c5cff] px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                Join GriidAi Today
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Start Your Geospatial AI Journey
              </h1>
              <p className="text-lg text-gray-600">
                Unlock the power of location intelligence with our advanced AI platform.
              </p>
            </div>

            <div className="space-y-4">
              {[
                { icon: Zap, title: 'Real-time Processing', desc: 'Process millions of data points in seconds' },
                { icon: CheckCircle2, title: 'AI-Powered Insights', desc: 'Machine learning models for spatial analysis' },
                { icon: Gift, title: 'Free Trial', desc: '14-day free trial with no credit card required' },
              ].map((benefit) => (
                <div key={benefit.title} className="flex items-start gap-4 p-4 bg-white rounded-xl shadow-sm">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <benefit.icon className="w-5 h-5 text-[#7c5cff]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{benefit.title}</h3>
                    <p className="text-sm text-gray-500">{benefit.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Testimonial */}
            <div className="mt-8 p-6 bg-[#0a0618] rounded-2xl">
              <p className="text-white/80 italic mb-4">
                "GriidAi transformed how we analyze location data. The AI-powered insights are incredible."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#7c5cff] to-[#7337ff] rounded-full flex items-center justify-center">
                  <span className="text-white font-medium">JD</span>
                </div>
                <div>
                  <p className="text-white font-medium">John Doe</p>
                  <p className="text-white/60 text-sm">CTO, GeoTech Solutions</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Form */}
          <div className="lg:pl-8">
            <Card className="border-0 shadow-xl shadow-purple-500/5">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 bg-gradient-to-br from-[#7c5cff] to-[#7337ff] rounded-xl flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-2xl">{isLogin ? 'Welcome Back' : 'Create Your Account'}</CardTitle>
                <CardDescription>
                  {isLogin ? 'Sign in to access your dashboard' : 'Get started with GriidAi in minutes'}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {/* Referral Banner */}
                {!isLogin && referralCode && (
                  <div className={`mb-6 p-4 rounded-xl ${isValid ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                    {isValidating ? (
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />
                        <span className="text-sm text-yellow-700">Validating referral code...</span>
                      </div>
                    ) : isValid ? (
                      <div className="flex items-start gap-3">
                        <Gift className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-green-800 text-sm">
                            You were invited by {referrerName}!
                          </p>
                          <p className="text-green-700 text-sm mt-1">
                            Get 1-week GriidAi trial access after signup.
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              Code: {referralCode}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-yellow-800 text-sm">
                            Invalid referral code
                          </p>
                          <p className="text-yellow-700 text-sm mt-1">
                            The code you entered is invalid or expired.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Referral Code Input (if not provided) */}
                {!isLogin && !referralCode && (
                  <div className="mb-6">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Have a referral code?
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter referral code"
                        className="flex-1"
                      />
                      <Button variant="outline">Apply</Button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            placeholder="John Doe"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="pl-10"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Organization</label>
                        <div className="relative">
                          <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            placeholder="Company name"
                            value={formData.organization}
                            onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                            className="pl-10"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type="email"
                        placeholder="you@company.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type="password"
                        placeholder="Create a strong password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="pl-10"
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      Must be at least 8 characters with uppercase, lowercase, and number
                    </p>
                  </div>
                  
                  {!isLogin && (
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="terms"
                        checked={formData.agreeTerms}
                        onCheckedChange={(checked) => setFormData({ ...formData, agreeTerms: checked as boolean })}
                      />
                      <label htmlFor="terms" className="text-sm text-gray-600 leading-relaxed">
                        I agree to the{' '}
                        <a href="#" className="text-[#7c5cff] hover:underline">Terms of Service</a>
                        {' '}and{' '}
                        <a href="#" className="text-[#7c5cff] hover:underline">Privacy Policy</a>
                      </label>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 bg-gradient-to-r from-[#7c5cff] to-[#7337ff] hover:from-[#6b4fe0] hover:to-[#622ce0] text-white shadow-lg shadow-purple-500/25"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        {isLogin ? 'Signing in...' : 'Creating account...'}
                      </>
                    ) : (
                      <>
                        {isLogin ? 'Sign In' : 'Create Account'}
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600">
                    {isLogin ? "Don't have an account?" : 'Already have an account?'}
                    <button 
                      onClick={() => setIsLogin(!isLogin)}
                      className="text-[#7c5cff] font-medium hover:underline ml-1"
                    >
                      {isLogin ? 'Sign up' : 'Sign in'}
                    </button>
                  </p>
                </div>

                <div className="mt-6 pt-6 border-t">
                  <p className="text-xs text-gray-500 text-center mb-4">Or sign up with</p>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1">
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Google
                    </Button>
                    <Button variant="outline" className="flex-1">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                      GitHub
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
