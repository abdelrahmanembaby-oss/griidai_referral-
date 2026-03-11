import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  Crown, CreditCard, Star, Copy, Check, 
  Users, DollarSign, Mail, Linkedin, 
  CheckCircle2, HelpCircle, Clock, XCircle,
  LayoutDashboard, Settings, Bell, ChevronRight,
  BarChart3, Shield
} from 'lucide-react';
import { referralTiers, qualificationRules } from '@/data/mockData';
import { useAppContext } from '@/contexts/AppContext';
import type { ReferralStatus } from '@/types';
import { toast } from 'sonner';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

interface DashboardProps {
  onNavigate: (page: 'landing' | 'dashboard' | 'signup' | 'admin') => void;
}

const statusConfig: Record<ReferralStatus, { label: string; color: string; icon: any; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-600', icon: Clock, bgColor: 'bg-yellow-100' },
  signed_up: { label: 'Signed Up', color: 'text-blue-600', icon: CheckCircle2, bgColor: 'bg-blue-100' },
  verified: { label: 'Verified', color: 'text-indigo-600', icon: Shield, bgColor: 'bg-indigo-100' },
  qualified: { label: 'Qualified', color: 'text-green-600', icon: CheckCircle2, bgColor: 'bg-green-100' },
  rewarded: { label: 'Rewarded', color: 'text-purple-600', icon: Star, bgColor: 'bg-purple-100' },
  rejected: { label: 'Rejected', color: 'text-red-600', icon: XCircle, bgColor: 'bg-red-100' },
};

export function Dashboard({ }: DashboardProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const { currentUser, referrals, referralStats, notifications, markNotificationAsRead } = useAppContext();

  const referralLink = `https://app.griidai.com/signup?ref=${currentUser?.referral_code.split('-').pop()}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Referral link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = (platform: string) => {
    toast.success(`Sharing to ${platform}...`);
  };

  // Chart data
  const referralChartData = [
    { name: 'Jan', referrals: 2 },
    { name: 'Feb', referrals: 3 },
    { name: 'Mar', referrals: 5 },
    { name: 'Apr', referrals: 4 },
    { name: 'May', referrals: 8 },
    { name: 'Jun', referrals: 12 },
  ];

  const statusChartData = [
    { name: 'Pending', value: referrals.filter(r => r.status === 'pending').length, color: '#fbbf24' },
    { name: 'Signed Up', value: referrals.filter(r => r.status === 'signed_up').length, color: '#3b82f6' },
    { name: 'Qualified', value: referrals.filter(r => r.status === 'qualified').length, color: '#22c55e' },
    { name: 'Rewarded', value: referrals.filter(r => r.status === 'rewarded').length, color: '#7c5cff' },
  ].filter(d => d.value > 0);

  const getCurrentTierProgress = () => {
    const currentTier = referralTiers[referralStats.current_tier - 1];
    const nextTier = referralTiers[referralStats.current_tier];
    const progress = ((currentTier.referrals - referralStats.next_tier_referrals) / currentTier.referrals) * 100;
    return { currentTier, nextTier, progress: Math.max(0, Math.min(100, progress)) };
  };

  const tierProgress = getCurrentTierProgress();

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="w-full px-8 lg:px-16 2xl:px-24 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">Welcome back, {currentUser?.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 relative">
                    <Bell className="w-4 h-4" />
                    {notifications.filter(n => !n.read).length > 0 && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                    )}
                    <span className="hidden sm:inline">Notifications</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 max-h-[400px] overflow-y-auto">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">No new notifications</div>
                  ) : (
                    notifications.map(notif => (
                      <DropdownMenuItem key={notif.id} className="flex flex-col items-start gap-1 p-3 cursor-pointer" onClick={() => markNotificationAsRead(notif.id)}>
                        <div className="flex justify-between w-full">
                          <span className={`font-medium text-sm ${!notif.read ? 'text-gray-900' : 'text-gray-500'}`}>{notif.title}</span>
                          {!notif.read && <span className="w-2 h-2 bg-blue-500 rounded-full mt-1" />}
                        </div>
                        <span className="text-xs text-gray-500">{notif.message}</span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Credits', value: currentUser?.total_credits.toLocaleString() || '0', icon: CreditCard, color: 'from-purple-500 to-indigo-500' },
            { label: 'Total Invited', value: referralStats.total_invited.toString(), icon: Users, color: 'from-blue-500 to-cyan-500' },
            { label: 'Qualified', value: referralStats.qualified.toString(), icon: CheckCircle2, color: 'from-green-500 to-emerald-500' },
            { label: 'Credits Earned', value: `$${referralStats.total_credits_earned}`, icon: DollarSign, color: 'from-amber-500 to-orange-500' },
          ].map((stat) => (
            <Card key={stat.label} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border shadow-sm p-1">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="referrals" className="gap-2">
              <Users className="w-4 h-4" />
              Referrals
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="rewards" className="gap-2">
              <Star className="w-4 h-4" />
              Rewards
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Quick Actions */}
              <Card className="lg:col-span-2 border-0 shadow-sm">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Manage your account and referrals</CardDescription>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-auto p-4 justify-start gap-4 hover:border-purple-300 hover:bg-purple-50"
                    onClick={() => setActiveTab('referrals')}
                  >
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-[#7c5cff]" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">View Referrals</p>
                      <p className="text-sm text-gray-500">{referralStats.total_invited} total invited</p>
                    </div>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-auto p-4 justify-start gap-4 hover:border-purple-300 hover:bg-purple-50"
                    onClick={() => setActiveTab('rewards')}
                  >
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <Star className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">View Rewards</p>
                      <p className="text-sm text-gray-500">${referralStats.total_credits_earned} earned</p>
                    </div>
                  </Button>
                  <Button variant="outline" className="h-auto p-4 justify-start gap-4 hover:border-purple-300 hover:bg-purple-50" onClick={() => toast.info('Credits top-up dialog opened')}>
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Buy Credits</p>
                      <p className="text-sm text-gray-500">Add more compute credits</p>
                    </div>
                  </Button>
                  <Button variant="outline" className="h-auto p-4 justify-start gap-4 hover:border-purple-300 hover:bg-purple-50" onClick={() => toast.info('Support form opened')}>
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <HelpCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">Get Support</p>
                      <p className="text-sm text-gray-500">Contact our team</p>
                    </div>
                  </Button>
                </CardContent>
              </Card>

              {/* Plan Info */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle>Your Plan</CardTitle>
                  <CardDescription>Current subscription details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#7c5cff] to-[#7337ff] rounded-xl flex items-center justify-center">
                      <Crown className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg capitalize">{currentUser?.plan_type}</p>
                      <Badge variant="secondary" className="bg-green-100 text-green-700">Active</Badge>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-500">Credits Remaining</span>
                      <span className="font-medium">{currentUser?.total_credits.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Expires</span>
                      <span className="font-medium">{currentUser ? new Date(currentUser.credits_expiry_date || '').toLocaleDateString() : '-'}</span>
                    </div>
                  </div>
                  <Button className="w-full bg-gradient-to-r from-[#7c5cff] to-[#7337ff] text-white">
                    Upgrade Plan
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Recent Referrals */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Referrals</CardTitle>
                  <CardDescription>Latest activity from your referrals</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setActiveTab('referrals')}>
                  View All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {referrals.slice(0, 5).map((referral) => (
                    <div key={referral.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-[#7c5cff]">
                            {referral.referred_user?.name?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{referral.referred_user?.name || 'Pending User'}</p>
                          <p className="text-xs text-gray-500">{referral.referred_user?.email || 'Waiting for signup'}</p>
                        </div>
                      </div>
                      {(() => {
                        const StatusIcon = statusConfig[referral.status].icon;
                        return (
                          <Badge className={`${statusConfig[referral.status].bgColor} ${statusConfig[referral.status].color} border-0`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig[referral.status].label}
                          </Badge>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Referrals Tab */}
          <TabsContent value="referrals" className="space-y-6">
            {/* Share Your Link Card */}
            <Card className="border-0 shadow-lg shadow-purple-500/5 overflow-hidden">
              <div className="bg-gradient-to-r from-[#7c5cff] to-[#7337ff] p-8 text-white">
                <div className="max-w-2xl">
                  <h2 className="text-2xl font-bold mb-2">Share Your Link</h2>
                  <p className="text-white/80 mb-6">
                    Invite your peers and friends to GriidAi. Earn compute credits or Pro access when they join and qualify.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <Input
                        value={referralLink}
                        readOnly
                        className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/50 pr-4"
                      />
                    </div>
                    <Button
                      onClick={handleCopyLink}
                      className="h-12 px-6 bg-white text-[#7c5cff] hover:bg-white/90"
                    >
                      {copied ? <Check className="w-5 h-5 mr-2" /> : <Copy className="w-5 h-5 mr-2" />}
                      {copied ? 'Copied!' : 'Copy Link'}
                    </Button>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShare('LinkedIn')}
                      className="border-white/30 text-white hover:bg-white/10"
                    >
                      <Linkedin className="w-4 h-4 mr-2" />
                      Share on LinkedIn
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShare('Email')}
                      className="border-white/30 text-white hover:bg-white/10"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Share via Email
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Tier Progress */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Your Progress</CardTitle>
                <CardDescription>Keep inviting to unlock more rewards</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Next Reward</span>
                    <span className="text-sm text-gray-500">
                      {referralStats.next_tier_referrals} more to unlock {tierProgress.nextTier?.reward}
                    </span>
                  </div>
                  <Progress value={tierProgress.progress} className="h-3" />
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {referralTiers.map((tier, index) => {
                    const isUnlocked = index < referralStats.current_tier;
                    const isCurrent = index === referralStats.current_tier - 1;
                    
                    return (
                      <div
                        key={tier.referrals}
                        className={`relative p-4 rounded-xl border-2 transition-all ${
                          isUnlocked
                            ? 'border-green-500 bg-green-50'
                            : isCurrent
                            ? 'border-[#7c5cff] bg-purple-50'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        {isUnlocked && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                          isUnlocked ? 'bg-green-500' : isCurrent ? 'bg-[#7c5cff]' : 'bg-gray-300'
                        }`}>
                          <Star className="w-5 h-5 text-white" />
                        </div>
                        <p className="font-semibold text-sm">{tier.referrals} Referrals</p>
                        <p className={`text-lg font-bold ${isUnlocked ? 'text-green-700' : isCurrent ? 'text-[#7c5cff]' : 'text-gray-500'}`}>
                          {tier.reward}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{tier.description}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Referral Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Invited', value: referralStats.total_invited, icon: Users },
                { label: 'Signed Up', value: referralStats.signed_up, icon: CheckCircle2 },
                { label: 'Qualified', value: referralStats.qualified, icon: Shield },
                { label: 'Rewards Earned', value: `$${referralStats.total_credits_earned}`, icon: DollarSign },
              ].map((stat) => (
                <Card key={stat.label} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <stat.icon className="w-5 h-5 text-[#7c5cff]" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                        <p className="text-xs text-gray-500">{stat.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Referral List Table */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Your Referrals</CardTitle>
                <CardDescription>Track the status of your invited users</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Email</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Reward</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referrals.map((referral) => (
                        <tr key={referral.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center">
                                <span className="text-xs font-medium text-[#7c5cff]">
                                  {referral.referred_user?.name?.charAt(0) || '?'}
                                </span>
                              </div>
                              <span className="font-medium text-sm">
                                {referral.referred_user?.name || 'Pending'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">
                            {referral.referred_user?.email || '-'}
                          </td>
                          <td className="py-3 px-4">
                            {(() => {
                              const StatusIcon = statusConfig[referral.status].icon;
                              return (
                                <Badge className={`${statusConfig[referral.status].bgColor} ${statusConfig[referral.status].color} border-0 text-xs`}>
                                  <StatusIcon className="w-3 h-3 mr-1" />
                                  {statusConfig[referral.status].label}
                                </Badge>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {referral.reward_type ? (
                              <span className="text-green-600 font-medium">
                                {referral.reward_type === '50_credits' ? '$50 Credits' : referral.reward_type}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {new Date(referral.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Qualification Rules */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Qualification Rules</CardTitle>
                <CardDescription>Referrals must meet these criteria to qualify for rewards</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                  {qualificationRules.map((rule) => (
                    <div key={rule.id} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-[#7c5cff]" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{rule.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle>Referrals Over Time</CardTitle>
                  <CardDescription>Monthly referral activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={referralChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" stroke="#888" fontSize={12} />
                        <YAxis stroke="#888" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="referrals" fill="#7c5cff" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle>Status Distribution</CardTitle>
                  <CardDescription>Current status of all referrals</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {statusChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 mt-4">
                    {statusChartData.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-gray-600">{item.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Conversion Funnel</CardTitle>
                <CardDescription>Track how referrals progress through the funnel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: 'Invited', value: referralStats.total_invited, total: referralStats.total_invited, color: 'bg-purple-500' },
                    { label: 'Signed Up', value: referralStats.signed_up, total: referralStats.total_invited, color: 'bg-blue-500' },
                    { label: 'Qualified', value: referralStats.qualified, total: referralStats.total_invited, color: 'bg-green-500' },
                    { label: 'Rewarded', value: referralStats.rewarded, total: referralStats.total_invited, color: 'bg-amber-500' },
                  ].map((stage) => (
                    <div key={stage.label} className="flex items-center gap-4">
                      <div className="w-24 text-sm font-medium">{stage.label}</div>
                      <div className="flex-1">
                        <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                          <div
                            className={`h-full ${stage.color} transition-all duration-500 flex items-center justify-end px-3`}
                            style={{ width: `${(stage.value / stage.total) * 100}%` }}
                          >
                            <span className="text-white text-sm font-medium">{stage.value}</span>
                          </div>
                        </div>
                      </div>
                      <div className="w-16 text-right text-sm text-gray-500">
                        {((stage.value / stage.total) * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rewards Tab */}
          <TabsContent value="rewards" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Total Earnings */}
              <Card className="lg:col-span-2 border-0 shadow-sm">
                <CardHeader>
                  <CardTitle>Total Earnings</CardTitle>
                  <CardDescription>All rewards earned through referrals</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center">
                      <DollarSign className="w-10 h-10 text-white" />
                    </div>
                    <div>
                      <p className="text-4xl font-bold text-gray-900">${referralStats.total_credits_earned}</p>
                      <p className="text-gray-500">Total credits earned</p>
                    </div>
                  </div>

                  <div className="mt-8 space-y-3">
                    <h4 className="font-medium text-sm text-gray-700">Reward History</h4>
                    {referrals
                      .filter(r => r.reward_granted)
                      .map((referral) => (
                        <div key={referral.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{referral.reward_type === '50_credits' ? '$50 Credits' : referral.reward_type}</p>
                              <p className="text-xs text-gray-500">From {referral.referred_user?.name}</p>
                            </div>
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(referral.qualified_at || '').toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Available Rewards */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle>Available Rewards</CardTitle>
                  <CardDescription>Rewards you can still unlock</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {referralTiers.map((tier) => (
                    <div key={tier.referrals} className="p-4 border border-gray-100 rounded-xl hover:border-purple-200 transition-colors">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Star className="w-5 h-5 text-[#7c5cff]" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{tier.reward}</p>
                          <p className="text-xs text-gray-500">{tier.referrals} referrals</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600">{tier.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
