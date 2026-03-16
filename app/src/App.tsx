import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { RightToolbar } from '@/components/RightToolbar';
import { ReferralModal } from '@/components/ReferralModal';
import { ChatHomePage } from '@/pages/ChatHomePage';
import { SignupPageNew } from '@/pages/SignupPageNew';
import { EarthExplorerPage } from '@/pages/EarthExplorerPage';

function App() {
  const [referralOpen, setReferralOpen] = useState(false);

  return (
    <AuthProvider>
      <div className="app-layout">
        <Sidebar onOpenReferral={() => setReferralOpen(true)} />

        <div className="app-content">
          <Routes>
            <Route path="/" element={<ChatHomePage />} />
            <Route path="/signup" element={<SignupPageNew />} />
            <Route path="/explorer" element={<EarthExplorerPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        <RightToolbar />

        <ReferralModal open={referralOpen} onClose={() => setReferralOpen(false)} />
        <Toaster position="top-right" />
      </div>
    </AuthProvider>
  );
}

export default App;
