import { useEffect, lazy, Suspense } from 'react';
import { Navigate, Routes, Route } from 'react-router';
import { MainLayout } from './shared/components/Layout/MainLayout';
import { ToastContainer, Loading } from './shared/components/UI';
import { PageSkeleton } from './features/openings/workshop/PageSkeleton';
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
// Conditionné à la déclaration : un lazy() hors condition ferait émettre le chunk
// (et ses données figées) dans le build de prod, même sans route pour l'atteindre.
// La v2 se publie en prod sous /v2 avec VITE_V2=1 au build (deploy.yml) ; l'aiguillage et la séance restent en dev.
const V2_PAGES = import.meta.env.DEV || import.meta.env.VITE_V2 === '1';
const FlameGraphPage = V2_PAGES
  ? lazy(() => import('./features/openings').then(m => ({ default: m.DesignPrototypeRoute })))
  : null;
const GameChecksPage = V2_PAGES
  ? lazy(() => import('./features/openings').then(m => ({ default: m.GameChecksPage })))
  : null;
const HomePage = import.meta.env.DEV
  ? lazy(() => import('./features/openings').then(m => ({ default: m.HomePage })))
  : null;
const SessionPage = import.meta.env.DEV
  ? lazy(() => import('./features/openings').then(m => ({ default: m.SessionPage })))
  : null;
const TreePage = V2_PAGES
  ? lazy(() => import('./features/openings').then(m => ({ default: m.TreePage })))
  : null;
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
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
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
        {FlameGraphPage && import.meta.env.DEV ? (
          <Route path="/dev/flame-graph" element={<Suspense fallback={<PageSkeleton />}><FlameGraphPage /></Suspense>} />
        ) : null}
        {FlameGraphPage ? (
          <Route path="/v2/openings" element={<Suspense fallback={<PageSkeleton />}><FlameGraphPage /></Suspense>} />
        ) : null}
        {GameChecksPage && import.meta.env.DEV ? (
          <Route path="/dev/games" element={<Suspense fallback={<PageSkeleton />}><GameChecksPage /></Suspense>} />
        ) : null}
        {GameChecksPage ? (
          <Route path="/v2/games" element={<Suspense fallback={<PageSkeleton />}><GameChecksPage /></Suspense>} />
        ) : null}
        {HomePage ? (
          <Route path="/dev/home" element={<Suspense fallback={<Loading size="lg" />}><HomePage /></Suspense>} />
        ) : null}
        {SessionPage ? (
          <Route path="/dev/session" element={<Suspense fallback={<Loading size="lg" />}><SessionPage /></Suspense>} />
        ) : null}
        {TreePage && import.meta.env.DEV ? (
          <Route path="/dev/tree" element={<Suspense fallback={<PageSkeleton />}><TreePage /></Suspense>} />
        ) : null}
        {TreePage ? (
          <Route path="/v2/tree" element={<Suspense fallback={<PageSkeleton />}><TreePage /></Suspense>} />
        ) : null}
        {TreePage ? <Route path="/v2" element={<Navigate to="/v2/tree" replace />} /> : null}
        <Route path="*" element={<Suspense fallback={<Loading size="lg" />}><NotFoundPage /></Suspense>} />
      </Routes>
      <ToastContainer />
    </div>
  );
}

export default App;
