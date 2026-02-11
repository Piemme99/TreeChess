import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { MainLayout } from './shared/components/Layout/MainLayout';
import { ToastContainer, Loading } from './shared/components/UI';
import { LoginPage } from './features/auth/LoginPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { LandingPage } from './features/landing';
import { ProtectedRoute } from './shared/components/ProtectedRoute';
import { PublicRoute } from './shared/components/PublicRoute';
import { useAuthStore } from './stores/authStore';

const Dashboard = lazy(() => import('./features/dashboard/Dashboard').then(m => ({ default: m.Dashboard })));
const RepertoireTab = lazy(() => import('./features/repertoire/RepertoireTab').then(m => ({ default: m.RepertoireTab })));
const GamesPage = lazy(() => import('./features/games').then(m => ({ default: m.GamesPage })));
const ProfilePage = lazy(() => import('./features/profile').then(m => ({ default: m.ProfilePage })));
const GameAnalysisPage = lazy(() => import('./features/game-analysis').then(m => ({ default: m.GameAnalysisPage })));
const RepertoireEdit = lazy(() => import('./features/repertoire/RepertoireEdit').then(m => ({ default: m.RepertoireEdit })));
const TrainingPage = lazy(() => import('./features/training').then(m => ({ default: m.TrainingPage })));
const ExplorePage = lazy(() => import('./features/explore').then(m => ({ default: m.ExplorePage })));
const NotFoundPage = lazy(() => import('./features/not-found/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const handleUnauthorized = () => {
      useAuthStore.getState().logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

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
          <Route path="dashboard" element={<Suspense fallback={<Loading size="lg" />}><Dashboard /></Suspense>} />
          <Route path="repertoires" element={<Suspense fallback={<Loading size="lg" />}><RepertoireTab /></Suspense>} />
          <Route path="training" element={<Suspense fallback={<Loading size="lg" />}><TrainingPage /></Suspense>} />
          <Route path="games" element={<Suspense fallback={<Loading size="lg" />}><GamesPage /></Suspense>} />
          <Route path="profile" element={<Suspense fallback={<Loading size="lg" />}><ProfilePage /></Suspense>} />
          <Route path="analyse/:id/game/:gameIndex" element={<Suspense fallback={<Loading size="lg" />}><GameAnalysisPage /></Suspense>} />
          <Route path="repertoire/:id/edit" element={<Suspense fallback={<Loading size="lg" />}><RepertoireEdit /></Suspense>} />
          <Route path="explore" element={<Suspense fallback={<Loading size="lg" />}><ExplorePage /></Suspense>} />
          <Route path="explore/repertoire/:id" element={<Suspense fallback={<Loading size="lg" />}><RepertoireEdit /></Suspense>} />
        </Route>
        <Route path="*" element={<Suspense fallback={<Loading size="lg" />}><NotFoundPage /></Suspense>} />
      </Routes>
      <ToastContainer />
    </div>
  );
}

export default App;
