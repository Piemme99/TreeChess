import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MainLayout } from './shared/components/Layout/MainLayout';
import { Dashboard } from './features/dashboard';
import { RepertoireTab } from './features/repertoire/RepertoireTab';
import { GamesPage } from './features/games';
import { GameAnalysisPage } from './features/game-analysis';
import { RepertoireEdit } from './features/repertoire/RepertoireEdit';
import { ToastContainer } from './shared/components/UI';
import { LoginPage } from './features/auth/LoginPage';
import { ProtectedRoute } from './shared/components/ProtectedRoute';
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
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<PageWrapper><Dashboard /></PageWrapper>} />
          <Route path="repertoires" element={<PageWrapper><RepertoireTab /></PageWrapper>} />
          <Route path="games" element={<PageWrapper><GamesPage /></PageWrapper>} />
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
