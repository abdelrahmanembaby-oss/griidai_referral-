import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, MoreHorizontal, Settings, Copy } from 'lucide-react';

type SidebarProps = {
  onOpenReferral: () => void;
};

export function Sidebar({ onOpenReferral }: SidebarProps) {
  const { user, logout } = useAuth();
  const [sessions] = useState([
    { id: '1', title: 'New Session', active: true },
    { id: '2', title: 'New Session', active: false },
  ]);

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#2b8a8a" strokeWidth="2" />
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10" stroke="#2b8a8a" strokeWidth="2" />
              <path d="M2 12h20M12 2c2.5 3 4 6.5 4 10s-1.5 7-4 10c-2.5-3-4-6.5-4-10s1.5-7 4-10z" stroke="#2b8a8a" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
          <span className="sidebar-brand">GriidAi<sup>™</sup></span>
        </div>
        <button className="sidebar-icon-btn" title="Copy">
          <Copy size={16} />
        </button>
      </div>

      {/* New Chat */}
      <button className="sidebar-new-chat">
        <Plus size={16} />
        <span>New Chat</span>
      </button>

      {/* History */}
      <div className="sidebar-section-label">HISTORY</div>
      <div className="sidebar-sessions">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`sidebar-session ${s.active ? 'sidebar-session--active' : ''}`}
          >
            <span className="sidebar-session-title">{s.title}</span>
            {s.active && (
              <button className="sidebar-session-more">
                <MoreHorizontal size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Refer & Earn */}
      <button className="sidebar-refer-btn" onClick={onOpenReferral}>
        🎁 Refer &amp; Earn
      </button>

      {/* Storage */}
      <div className="sidebar-storage">
        <div className="sidebar-storage-header">
          <span className="sidebar-storage-label">Storage</span>
          <span className="sidebar-storage-value">185.32 MB / 50 GB</span>
        </div>
        <div className="sidebar-storage-bar">
          <div className="sidebar-storage-fill" style={{ width: '0.4%' }} />
        </div>
        <div className="sidebar-storage-legend">
          <span className="sidebar-legend-item">
            <span className="sidebar-legend-dot sidebar-legend-dot--perm" />
            Permanent
          </span>
          <span className="sidebar-legend-item">
            <span className="sidebar-legend-dot sidebar-legend-dot--temp" />
            Temporary
          </span>
        </div>
      </div>

      {/* User Profile */}
      <div className="sidebar-user">
        <div className="sidebar-user-avatar">
          {user?.email ? user.email.charAt(0).toUpperCase() : 'A'}
        </div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user?.email?.split('@')[0] || 'Abdelrahman Embaby'}</div>
          <div className="sidebar-user-plan">{user?.plan_type?.toUpperCase() || 'FREE PLAN'}</div>
        </div>
        <button className="sidebar-icon-btn" title="Settings" onClick={logout}>
          <Settings size={16} />
        </button>
      </div>
    </aside>
  );
}
