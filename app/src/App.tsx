import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { TopBar } from '@/components/TopBar';
import { ChatHomePage } from '@/pages/ChatHomePage';
import { ReferralPage } from '@/pages/ReferralPage';
import { SignupPageNew } from '@/pages/SignupPageNew';

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background font-sans antialiased">
        <TopBar />
        <main>
          <Routes>
            <Route path="/" element={<ChatHomePage />} />
            <Route path="/referral" element={<ReferralPage />} />
            <Route path="/signup" element={<SignupPageNew />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Toaster position="top-right" />
      </div>
    </AuthProvider>
  );
}

export default App;
