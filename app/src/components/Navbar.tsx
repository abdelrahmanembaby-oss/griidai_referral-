import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X, Zap, LayoutDashboard, Shield, Home, LogOut, User } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: 'landing' | 'dashboard' | 'signup' | 'admin') => void;
}

export function Navbar({ currentPage, onNavigate }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { currentUser, setCurrentUser } = useAppContext();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { id: 'landing', label: 'Home', icon: Home },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'admin', label: 'Admin', icon: Shield },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? 'bg-white/90 backdrop-blur-xl shadow-lg shadow-purple-500/5'
          : 'bg-transparent'
      }`}
    >
      <div className="w-full px-8 lg:px-16 2xl:px-24">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <button
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7c5cff] to-[#7337ff] flex items-center justify-center shadow-lg shadow-purple-500/25 group-hover:shadow-purple-500/40 transition-all duration-300 group-hover:scale-105">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-[#0a0618] to-[#7c5cff] bg-clip-text text-transparent">
              GriidAi
            </span>
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => onNavigate(link.id as any)}
                className={`relative px-4 py-2 text-sm font-medium transition-all duration-300 rounded-lg ${
                  currentPage === link.id
                    ? 'text-[#7c5cff] bg-purple-50'
                    : 'text-gray-600 hover:text-[#7c5cff] hover:bg-purple-50/50'
                }`}
              >
                {link.label}
                {currentPage === link.id && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#7c5cff]" />
                )}
              </button>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {currentUser ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 text-sm font-medium text-purple-700">
                  <User className="w-4 h-4" />
                  {currentUser.name}
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setCurrentUser(null);
                    onNavigate('landing');
                  }}
                  className="text-gray-600 hover:text-red-500"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => onNavigate('signup')}
                  className="text-gray-600 hover:text-[#7c5cff]"
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => onNavigate('signup')}
                  className="bg-gradient-to-r from-[#7c5cff] to-[#7337ff] hover:from-[#6b4fe0] hover:to-[#622ce0] text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 hover:scale-105"
                >
                  Get Started
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-purple-50 transition-colors"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6 text-gray-600" />
            ) : (
              <Menu className="w-6 h-6 text-gray-600" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100 animate-in slide-in-from-top-2">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => {
                    onNavigate(link.id as any);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                    currentPage === link.id
                      ? 'text-[#7c5cff] bg-purple-50'
                      : 'text-gray-600 hover:bg-purple-50/50'
                  }`}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </button>
              ))}
              <div className="pt-2 border-t border-gray-100 mt-2">
                {currentUser ? (
                  <Button
                    onClick={() => {
                      setCurrentUser(null);
                      setIsMobileMenuOpen(false);
                      onNavigate('landing');
                    }}
                    variant="outline"
                    className="w-full text-red-500 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      onNavigate('signup');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full bg-gradient-to-r from-[#7c5cff] to-[#7337ff] text-white"
                  >
                    Get Started
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
