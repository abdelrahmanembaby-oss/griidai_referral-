import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, ArrowRight, CheckCircle2, Globe2, Cpu, 
  Shield, Users, BarChart3, Layers, Map, Satellite,
  Mail, Linkedin, Twitter, Github, Play
} from 'lucide-react';

interface LandingPageProps {
  onNavigate: (page: 'landing' | 'dashboard' | 'signup' | 'admin', code?: string) => void;
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroEmail, setHeroEmail] = useState('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    document.querySelectorAll('.reveal-on-scroll').forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const features = [
    { icon: Cpu, title: 'Real-time Data Processing', desc: 'Process millions of location data points in seconds with our distributed computing infrastructure.' },
    { icon: Globe2, title: 'AI-Powered Insights', desc: 'Machine learning models that understand spatial relationships and extract meaningful patterns.' },
    { icon: BarChart3, title: 'Interactive Visualizations', desc: 'Beautiful, interactive maps and dashboards that bring your geospatial data to life.' },
    { icon: Layers, title: 'API Integration', desc: 'Seamless integration with your existing tools and workflows through our REST API.' },
    { icon: Users, title: 'Collaboration Tools', desc: 'Share insights and work together in real-time with your team members.' },
    { icon: Shield, title: 'Enterprise Security', desc: 'Bank-level security with SOC 2 compliance for your sensitive geospatial data.' },
  ];

  const services = [
    { icon: Map, title: 'Data Processing', desc: 'Clean, transform, and prepare your geospatial data' },
    { icon: Cpu, title: 'AI Model Training', desc: 'Custom models for your specific use case' },
    { icon: Layers, title: 'Vectorization', desc: 'Convert any raster to precise vectors' },
    { icon: BarChart3, title: 'Spatial Analysis', desc: 'Extract insights from location data' },
    { icon: Globe2, title: 'Visualization', desc: 'Interactive dashboards and maps' },
    { icon: Satellite, title: 'API Development', desc: 'Integrate geospatial capabilities' },
  ];

  const stats = [
    { value: '10M+', label: 'Data Points Processed' },
    { value: '500+', label: 'Enterprise Clients' },
    { value: '99.9%', label: 'Uptime SLA' },
    { value: '50+', label: 'Countries Served' },
  ];

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen pt-20 flex items-center">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-gradient-to-br from-purple-200/40 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-gradient-to-tl from-indigo-200/30 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-gradient-radial from-purple-100/50 via-transparent to-transparent" />
          
          {/* Particle Grid */}
          <div className="absolute inset-0 opacity-30">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-purple-400 rounded-full animate-float"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${4 + Math.random() * 4}s`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="relative w-full px-8 lg:px-16 2xl:px-24 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <Badge className="bg-purple-100 text-[#7c5cff] hover:bg-purple-200 px-4 py-1.5 text-sm font-medium animate-fade-in">
                🚀 Now with Advanced Raster-to-Vector AI
              </Badge>
              
              <h1 className="text-6xl lg:text-7xl font-bold leading-tight">
                <span className="bg-gradient-to-r from-[#0a0618] via-[#7c5cff] to-[#7337ff] bg-clip-text text-transparent">
                  Unlock the Power of Geospatial AI
                </span>
              </h1>
              
              <p className="text-2xl text-gray-600 leading-relaxed max-w-2xl">
                Transform location data into actionable intelligence with our advanced AI platform. Process millions of data points in seconds.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 max-w-sm">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={heroEmail}
                    onChange={(e) => setHeroEmail(e.target.value)}
                    className="h-14 lg:h-16 px-6 text-lg border-gray-200 focus:border-[#7c5cff] focus:ring-[#7c5cff]/20 rounded-xl"
                  />
                </div>
                <Button
                  onClick={() => onNavigate('signup', heroEmail ? `email:${heroEmail}` : undefined)}
                  className="h-14 lg:h-16 px-10 text-lg rounded-xl bg-gradient-to-r from-[#7c5cff] to-[#7337ff] hover:from-[#6b4fe0] hover:to-[#622ce0] text-white shadow-xl shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 hover:scale-105 group"
                >
                  Get Early Access
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>

              <div className="flex items-center gap-6 text-sm text-gray-500">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  No credit card required
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  14-day free trial
                </span>
              </div>
            </div>

            <div className="relative lg:h-[700px] flex items-center justify-center mt-12 lg:mt-0">
              <div className="relative w-full max-w-2xl">
                {/* Main Illustration */}
                <div className="relative bg-white rounded-3xl shadow-2xl shadow-purple-500/10 p-8 border border-purple-100 animate-float">
                  <div className="aspect-square bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80')] bg-cover bg-center opacity-20" />
                    <div className="relative z-10 text-center">
                      <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-[#7c5cff] to-[#7337ff] rounded-3xl flex items-center justify-center shadow-xl">
                        <Globe2 className="w-16 h-16 text-white" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 w-40 mx-auto bg-purple-200 rounded-full" />
                        <div className="h-3 w-28 mx-auto bg-purple-200 rounded-full" />
                      </div>
                    </div>
                    
                    {/* Floating Elements */}
                    <div className="absolute top-4 left-4 bg-white rounded-xl p-3 shadow-lg animate-bounce" style={{ animationDuration: '3s' }}>
                      <Satellite className="w-6 h-6 text-[#7c5cff]" />
                    </div>
                    <div className="absolute bottom-4 right-4 bg-white rounded-xl p-3 shadow-lg animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>
                      <Map className="w-6 h-6 text-[#7337ff]" />
                    </div>
                    <div className="absolute top-1/2 -right-4 bg-white rounded-xl p-3 shadow-lg animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '0.5s' }}>
                      <BarChart3 className="w-6 h-6 text-green-500" />
                    </div>
                  </div>
                </div>

                {/* Stats Card */}
                <div className="absolute -bottom-8 -left-8 bg-white rounded-2xl p-4 shadow-xl border border-purple-100 animate-float" style={{ animationDelay: '1s', zIndex: 10 }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-gray-900">10M+ Processed</p>
                      <p className="text-sm text-gray-500">Data points today</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trusted By */}
          <div className="mt-24 pt-12 border-t border-gray-100">
            <p className="text-center text-sm text-gray-500 mb-8">Trusted by 1000+ companies worldwide</p>
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-50">
              {['Google', 'Microsoft', 'Amazon', 'Meta', 'Apple'].map((company) => (
                <span key={company} className="text-xl font-bold text-gray-400">{company}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-[#0a0618] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#7c5cff]/10 to-[#7337ff]/10" />
        <div className="w-full px-8 lg:px-16 2xl:px-24 relative">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className="reveal-on-scroll text-center opacity-0 translate-y-8 transition-all duration-700"
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="text-gray-400 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(124,92,255,0.03)_1px,transparent_1px)] bg-[length:32px_32px]" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16 reveal-on-scroll opacity-0 translate-y-8 transition-all duration-700">
            <Badge className="bg-purple-100 text-[#7c5cff] mb-4">Features</Badge>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Powerful Features</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to harness the power of geospatial AI
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="reveal-on-scroll group bg-white rounded-2xl p-8 border border-gray-100 hover:border-purple-200 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-500 opacity-0 translate-y-8"
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                  <feature.icon className="w-7 h-7 text-[#7c5cff]" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12 reveal-on-scroll opacity-0 translate-y-8 transition-all duration-700" style={{ transitionDelay: '600ms' }}>
            <Button
              variant="outline"
              onClick={() => onNavigate('dashboard')}
              className="border-[#7c5cff] text-[#7c5cff] hover:bg-purple-50"
            >
              View All Features
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-24 bg-gradient-to-b from-white to-purple-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="reveal-on-scroll opacity-0 -translate-x-8 transition-all duration-700">
              <Badge className="bg-purple-100 text-[#7c5cff] mb-4">About GriidAi</Badge>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Pioneering the Future of Geospatial Intelligence
              </h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  Founded by a team of geospatial experts and AI researchers, GriidAi is on a mission to democratize access to powerful location analytics.
                </p>
                <p>
                  Our platform combines cutting-edge machine learning with intuitive visualization tools, making complex geospatial analysis accessible to everyone.
                </p>
              </div>
              <Button
                onClick={() => onNavigate('dashboard')}
                className="mt-8 bg-gradient-to-r from-[#7c5cff] to-[#7337ff] text-white"
              >
                Learn Our Story
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>

            <div className="relative reveal-on-scroll opacity-0 translate-x-8 transition-all duration-700">
              <div className="relative bg-white rounded-3xl shadow-2xl shadow-purple-500/10 p-6 border border-purple-100">
                <div className="aspect-[4/3] bg-gradient-to-br from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#7c5cff] to-[#7337ff] rounded-full flex items-center justify-center">
                      <Play className="w-8 h-8 text-white ml-1" />
                    </div>
                    <p className="text-gray-600 font-medium">Watch Our Story</p>
                  </div>
                </div>
              </div>
              
              {/* Floating Stats */}
              <div className="absolute -bottom-4 -right-4 bg-white rounded-xl p-4 shadow-xl border border-purple-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">500+</p>
                    <p className="text-xs text-gray-500">Enterprise Clients</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 reveal-on-scroll opacity-0 translate-y-8 transition-all duration-700">
            <Badge className="bg-purple-100 text-[#7c5cff] mb-4">Services</Badge>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Services</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              End-to-end geospatial solutions for every need
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, index) => (
              <div
                key={service.title}
                className="reveal-on-scroll group relative bg-white rounded-2xl p-6 border border-gray-100 hover:border-purple-200 hover:shadow-lg transition-all duration-500 opacity-0 translate-y-8"
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <service.icon className="w-6 h-6 text-[#7c5cff]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{service.title}</h3>
                    <p className="text-gray-600 text-sm">{service.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-24 bg-[#0a0618] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#7c5cff]/10 via-transparent to-[#7337ff]/10" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="reveal-on-scroll opacity-0 -translate-x-8 transition-all duration-700">
              <div className="relative">
                <div className="aspect-square bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-3xl flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-[#7c5cff] to-[#7337ff] rounded-3xl flex items-center justify-center shadow-2xl shadow-purple-500/30 animate-pulse">
                      <Zap className="w-16 h-16 text-white" />
                    </div>
                    <p className="text-white/60 text-lg">Powerful. Fast. Reliable.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="reveal-on-scroll opacity-0 translate-x-8 transition-all duration-700">
              <h2 className="text-4xl font-bold text-white mb-8">Why Choose GriidAi?</h2>
              
              <div className="space-y-6">
                {[
                  { title: 'Unmatched Accuracy', desc: 'Industry-leading precision in vector conversion' },
                  { title: 'Lightning Fast', desc: 'Process millions of features in minutes, not hours' },
                  { title: 'Enterprise Ready', desc: 'SOC 2 compliant with 99.9% uptime guarantee' },
                  { title: 'Expert Support', desc: 'Dedicated geospatial engineers at your service' },
                  { title: 'Flexible Pricing', desc: 'Pay for what you use, scale as you grow' },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold mb-1">{item.title}</h3>
                      <p className="text-white/60 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => onNavigate('signup')}
                className="mt-10 bg-white text-[#0a0618] hover:bg-gray-100"
              >
                Get Started Today
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-100 via-indigo-50 to-purple-100" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,92,255,0.1)_0%,transparent_70%)]" />
        
        <div className="w-full px-8 lg:px-16 2xl:px-24 relative text-center">
          <div className="reveal-on-scroll opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
              Ready to Transform Your Geospatial Data?
            </h2>
            <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
              Join thousands of companies using GriidAi to unlock the power of location intelligence
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <div className="flex-1 max-w-sm mx-auto sm:mx-0">
                <Input
                  type="email"
                  placeholder="Enter your work email"
                  className="h-14 px-6 bg-white border-0 shadow-lg"
                />
              </div>
              <Button
                onClick={() => onNavigate('signup')}
                className="h-14 px-8 bg-gradient-to-r from-[#7c5cff] to-[#7337ff] hover:from-[#6b4fe0] hover:to-[#622ce0] text-white shadow-xl shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 hover:scale-105"
              >
                Get Started Free
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                No credit card required
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                14-day free trial
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Cancel anytime
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0a0618] pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
            {/* Brand */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c5cff] to-[#7337ff] flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">GriidAi</span>
              </div>
              <p className="text-white/60 mb-6 max-w-sm">
                Transforming location data into actionable intelligence with advanced AI-powered geospatial analytics.
              </p>
              <div className="flex gap-4">
                {[Linkedin, Twitter, Github, Mail].map((Icon, i) => (
                  <a
                    key={i}
                    href="#"
                    className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-[#7c5cff] transition-colors duration-300"
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </a>
                ))}
              </div>
            </div>

            {/* Links */}
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'API Docs', 'Integrations'] },
              { title: 'Company', links: ['About', 'Blog', 'Careers', 'Contact'] },
              { title: 'Resources', links: ['Documentation', 'Tutorials', 'Case Studies', 'Support'] },
            ].map((column) => (
              <div key={column.title}>
                <h4 className="text-white font-semibold mb-4">{column.title}</h4>
                <ul className="space-y-3">
                  {column.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-white/60 hover:text-[#7c5cff] transition-colors text-sm">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-white/40 text-sm">
              © 2024 GriidAi. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm">
              <a href="#" className="text-white/40 hover:text-white/60 transition-colors">Privacy Policy</a>
              <a href="#" className="text-white/40 hover:text-white/60 transition-colors">Terms of Service</a>
              <a href="#" className="text-white/40 hover:text-white/60 transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        .reveal-on-scroll.animate-in {
          opacity: 1;
          transform: translateY(0) translateX(0);
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out forwards;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
