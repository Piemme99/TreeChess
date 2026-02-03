import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MainLayout } from './shared/components/Layout/MainLayout';
import { Dashboard } from './features/dashboard';
import { RepertoireTab } from './features/repertoire/RepertoireTab';
import { GamesPage } from './features/games';
import { ProfilePage } from './features/profile';
import { GameAnalysisPage } from './features/game-analysis';
import { RepertoireEdit } from './features/repertoire/RepertoireEdit';
import { ToastContainer } from './shared/components/UI';
import { LoginPage } from './features/auth/LoginPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { LandingPage } from './features/landing';
import { ProtectedRoute } from './shared/components/ProtectedRoute';
import { PublicRoute } from './shared/components/PublicRoute';
import { useAuthStore } from './stores/authStore';

function PageWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="animate-fade-in">
      {children}
    </div>
  );
}

function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <div className="app animate-fade-in">
      <Routes>
        <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<PageWrapper><Dashboard /></PageWrapper>} />
          <Route path="repertoires" element={<PageWrapper><RepertoireTab /></PageWrapper>} />
          <Route path="games" element={<PageWrapper><GamesPage /></PageWrapper>} />
          <Route path="profile" element={<PageWrapper><ProfilePage /></PageWrapper>} />
          <Route path="analyse/:id/game/:gameIndex" element={<PageWrapper><GameAnalysisPage /></PageWrapper>} />
          <Route path="repertoire/:id/edit" element={<RepertoireEdit />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </div>
  );
}

export default App;
