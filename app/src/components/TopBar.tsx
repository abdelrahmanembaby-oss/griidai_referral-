import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Zap, Gift, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function TopBar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  return (
    <div className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c5cff] to-[#7337ff] shadow-lg shadow-purple-500/25">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-[#0a0618] to-[#7c5cff] bg-clip-text text-transparent">
            GriidAi
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Button asChild variant={loc.pathname === '/referral' ? 'default' : 'outline'} className="gap-2">
            <Link to="/referral">
              <Gift className="h-4 w-4" />
              Referral
            </Link>
          </Button>

          {user ? (
            <>
              <div className="hidden sm:block text-sm text-gray-600">{user.email}</div>
              <Button
                variant="ghost"
                className="text-gray-700"
                onClick={() => {
                  logout();
                  nav('/');
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </>
          ) : (
            <Button asChild className="bg-gradient-to-r from-[#7c5cff] to-[#7337ff] text-white">
              <Link to="/signup">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

