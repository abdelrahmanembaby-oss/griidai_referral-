import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, Users, TrendingUp, AlertTriangle, Search,
  CheckCircle2, MoreHorizontal, Filter,
  Download, RefreshCw, MapPin, Mail, Smartphone, Building,
  Crown, BarChart3, Activity, Eye, Ban
} from 'lucide-react';
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AdminPanelProps {
  onNavigate: (page: 'landing' | 'dashboard' | 'signup' | 'admin') => void;
}

const statusConfig: Record<ReferralStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  signed_up: { label: 'Signed Up', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  verified: { label: 'Verified', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  qualified: { label: 'Qualified', color: 'text-green-600', bgColor: 'bg-green-100' },
  rewarded: { label: 'Rewarded', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  rejected: { label: 'Rejected', color: 'text-red-600', bgColor: 'bg-red-100' },
};

export function AdminPanel({ }: AdminPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReferralStatus | 'all'>('all');
  const { referrals, adminStats, approveReferral, rejectReferral } = useAppContext();

  // Filter referrals
  const filteredReferrals = referrals.filter(referral => {
    const matchesSearch = 
      referral.referred_user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      referral.referred_user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      referral.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || referral.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Chart data
  const monthlyData = [
    { month: 'Jan', referrals: 45, conversions: 32 },
    { month: 'Feb', referrals: 52, conversions: 38 },
    { month: 'Mar', referrals: 48, conversions: 35 },
    { month: 'Apr', referrals: 61, conversions: 44 },
    { month: 'May', referrals: 55, conversions: 41 },
    { month: 'Jun', referrals: 67, conversions: 49 },
  ];

  const abuseData = adminStats.suspicious_clusters.map(cluster => ({
    name: cluster.flag,
    value: cluster.count,
  }));

  const abuseColors = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6'];

  const handleAction = (action: string, referralId: string) => {
    if (action === 'Approve') {
      approveReferral(referralId);
      toast.success(`Referral ${referralId} approved successfully`);
    } else if (action === 'Reject') {
      rejectReferral(referralId);
      toast.success(`Referral ${referralId} rejected`);
    } else {
      toast.info(`View action triggered for ${referralId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="w-full px-8 lg:px-16 2xl:px-24 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[#7c5cff] to-[#7337ff] rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-gray-600 text-sm">Manage referrals and monitor system health</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { 
              label: 'Total Referrals (Month)', 
              value: adminStats.total_referrals_this_month.toString(), 
              icon: Users, 
              color: 'from-purple-500 to-indigo-500',
              trend: '+12%'
            },
            { 
              label: 'Conversion Rate', 
              value: `${adminStats.conversion_rate}%`, 
              icon: TrendingUp, 
              color: 'from-green-500 to-emerald-500',
              trend: '+5%'
            },
            { 
              label: 'Abuse Flags', 
              value: adminStats.abuse_detection_flags.toString(), 
              icon: AlertTriangle, 
              color: 'from-red-500 to-orange-500',
              trend: '-8%'
            },
            { 
              label: 'Active Users', 
              value: '2,847', 
              icon: Activity, 
              color: 'from-blue-500 to-cyan-500',
              trend: '+18%'
            },
          ].map((stat) => (
            <Card key={stat.label} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <span className="text-xs text-green-600 font-medium">{stat.trend} from last month</span>
                  </div>
                  <div className={`w-10 h-10 bg-gradient-to-br ${stat.color} rounded-lg flex items-center justify-center`}>
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="referrals" className="space-y-6">
          <TabsList className="bg-white border shadow-sm p-1">
            <TabsTrigger value="referrals" className="gap-2">
              <Users className="w-4 h-4" />
              All Referrals
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="top-referrers" className="gap-2">
              <Crown className="w-4 h-4" />
              Top Referrers
            </TabsTrigger>
            <TabsTrigger value="abuse" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              Abuse Detection
            </TabsTrigger>
          </TabsList>

          {/* Referrals Tab */}
          <TabsContent value="referrals" className="space-y-6">
            {/* Filters */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search by name, email, or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as ReferralStatus | 'all')}
                      className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="all">All Status</option>
                      {Object.entries(statusConfig).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                      ))}
                    </select>
                    <Button variant="outline" size="icon">
                      <Filter className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Referrals Table */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>All Referrals</CardTitle>
                <CardDescription>Manage and monitor all referral activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Referral ID</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Referred User</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Referrer</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Reward</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReferrals.map((referral) => (
                        <tr key={referral.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">{referral.id}</code>
                          </td>
                          <td className="py-3 px-4">
                            {referral.referred_user ? (
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center">
                                  <span className="text-xs font-medium text-[#7c5cff]">
                                    {referral.referred_user.name.charAt(0)}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{referral.referred_user.name}</p>
                                  <p className="text-xs text-gray-500">{referral.referred_user.email}</p>
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">Pending signup</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                                <span className="text-xs text-[#7c5cff]">A</span>
                              </div>
                              <span className="text-sm">Alex Chen</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={`${statusConfig[referral.status].bgColor} ${statusConfig[referral.status].color} border-0 text-xs`}>
                              {statusConfig[referral.status].label}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {referral.reward_granted ? (
                              <span className="text-green-600 font-medium text-sm">
                                {referral.reward_type === '50_credits' ? '$50' : referral.reward_type}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {new Date(referral.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleAction('View', referral.id)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAction('Approve', referral.id)}>
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Approve Reward
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAction('Reject', referral.id)} className="text-red-600">
                                  <Ban className="w-4 h-4 mr-2" />
                                  Reject
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredReferrals.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500">No referrals found matching your criteria</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle>Referrals & Conversions</CardTitle>
                  <CardDescription>Monthly referral activity and conversion rates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="month" stroke="#888" fontSize={12} />
                        <YAxis stroke="#888" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Line type="monotone" dataKey="referrals" stroke="#7c5cff" strokeWidth={2} dot={{ fill: '#7c5cff' }} />
                        <Line type="monotone" dataKey="conversions" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle>Status Distribution</CardTitle>
                  <CardDescription>Current status of all referrals in the system</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Pending', value: referrals.filter(r => r.status === 'pending').length, color: '#fbbf24' },
                            { name: 'Signed Up', value: referrals.filter(r => r.status === 'signed_up').length, color: '#3b82f6' },
                            { name: 'Verified', value: referrals.filter(r => r.status === 'verified').length, color: '#6366f1' },
                            { name: 'Qualified', value: referrals.filter(r => r.status === 'qualified').length, color: '#22c55e' },
                            { name: 'Rewarded', value: referrals.filter(r => r.status === 'rewarded').length, color: '#7c5cff' },
                            { name: 'Rejected', value: referrals.filter(r => r.status === 'rejected').length, color: '#ef4444' },
                          ].filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {[
                            { name: 'Pending', value: referrals.filter(r => r.status === 'pending').length, color: '#fbbf24' },
                            { name: 'Signed Up', value: referrals.filter(r => r.status === 'signed_up').length, color: '#3b82f6' },
                            { name: 'Verified', value: referrals.filter(r => r.status === 'verified').length, color: '#6366f1' },
                            { name: 'Qualified', value: referrals.filter(r => r.status === 'qualified').length, color: '#22c55e' },
                            { name: 'Rewarded', value: referrals.filter(r => r.status === 'rewarded').length, color: '#7c5cff' },
                            { name: 'Rejected', value: referrals.filter(r => r.status === 'rejected').length, color: '#ef4444' },
                          ].filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Conversion Funnel</CardTitle>
                <CardDescription>Track how users progress through the referral funnel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { label: 'Link Clicks', value: 1250, total: 1250, color: 'bg-purple-500' },
                    { label: 'Signups Started', value: 892, total: 1250, color: 'bg-blue-500' },
                    { label: 'Completed Signup', value: 624, total: 1250, color: 'bg-indigo-500' },
                    { label: 'Email Verified', value: 589, total: 1250, color: 'bg-cyan-500' },
                    { label: 'Qualified', value: 442, total: 1250, color: 'bg-green-500' },
                    { label: 'Rewarded', value: 389, total: 1250, color: 'bg-amber-500' },
                  ].map((stage) => (
                    <div key={stage.label} className="flex items-center gap-4">
                      <div className="w-32 text-sm font-medium">{stage.label}</div>
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
                        {((stage.value / stage.total) * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Top Referrers Tab */}
          <TabsContent value="top-referrers" className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Top Referrers</CardTitle>
                <CardDescription>Users with the most successful referrals this month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {adminStats.top_referrers.map((referrer, index) => (
                    <div key={referrer.user.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-200 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-purple-100 text-[#7c5cff]'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center">
                        <span className="font-medium text-[#7c5cff]">
                          {referrer.user.name.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{referrer.user.name}</p>
                        <p className="text-sm text-gray-500">{referrer.user.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-[#7c5cff]">{referrer.referral_count}</p>
                        <p className="text-xs text-gray-500">referrals</p>
                      </div>
                      <Badge className="bg-green-100 text-green-700">
                        ${referrer.referral_count * 50} earned
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Abuse Detection Tab */}
          <TabsContent value="abuse" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle>Suspicious Activity</CardTitle>
                  <CardDescription>Detected abuse patterns and flags</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={abuseData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" stroke="#888" fontSize={12} />
                        <YAxis dataKey="name" type="category" stroke="#888" fontSize={12} width={120} />
                        <Tooltip 
                          contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {abuseData.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={abuseColors[index % abuseColors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle>Abuse Prevention Rules</CardTitle>
                  <CardDescription>Active protection mechanisms</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { icon: MapPin, label: 'Same IP Detection', desc: 'Multiple accounts from same IP', status: 'active', count: 23 },
                      { icon: Building, label: 'Domain Matching', desc: 'Same organization domain', status: 'active', count: 18 },
                      { icon: Mail, label: 'Temporary Email', desc: 'Disposable email detection', status: 'active', count: 12 },
                      { icon: Smartphone, label: 'Device Fingerprint', desc: 'Same device multiple accounts', status: 'active', count: 8 },
                      { icon: Users, label: 'Self Referral', desc: 'User referring themselves', status: 'active', count: 5 },
                    ].map((rule) => (
                      <div key={rule.label} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                          <rule.icon className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{rule.label}</p>
                          <p className="text-xs text-gray-500">{rule.desc}</p>
                        </div>
                        <Badge variant="secondary" className="bg-red-100 text-red-700">
                          {rule.count} flagged
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Flagged Referrals</CardTitle>
                <CardDescription>Referrals requiring manual review</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {referrals
                    .filter(r => r.suspicious_flags && r.suspicious_flags.length > 0)
                    .map((referral) => (
                      <div key={referral.id} className="flex items-center gap-4 p-4 border border-red-100 bg-red-50 rounded-xl">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{referral.referred_user?.name || 'Unknown'}</p>
                            <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">
                              {referral.suspicious_flags?.join(', ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500">{referral.referred_user?.email}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleAction('Approve', referral.id)}>
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleAction('Reject', referral.id)}>
                            <Ban className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
