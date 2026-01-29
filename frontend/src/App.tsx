import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './shared/components/Layout/MainLayout';
import { GameAnalysisPage } from './features/game-analysis';
import { RepertoireEdit } from './features/repertoire/RepertoireEdit';
import { VideoRepertoirePreview } from './features/video-import/VideoRepertoirePreview';
import { ToastContainer } from './shared/components/UI';
import { LoginPage } from './features/auth/LoginPage';
import { ProtectedRoute } from './shared/components/ProtectedRoute';
import { useAuthStore } from './stores/authStore';

function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <div className="app">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analyse/:id/game/:gameIndex"
          element={
            <ProtectedRoute>
              <GameAnalysisPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/repertoire/:id/edit"
          element={
            <ProtectedRoute>
              <RepertoireEdit />
            </ProtectedRoute>
          }
        />
        <Route
          path="/video-import/:id/review"
          element={
            <ProtectedRoute>
              <VideoRepertoirePreview />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </div>
  );
}

export default App;
