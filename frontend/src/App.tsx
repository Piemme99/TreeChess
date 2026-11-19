import { useEffect, lazy, Suspense } from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router';
import { PageSkeleton } from './features/openings/workshop/PageSkeleton';
import { useAuthStore } from './stores/authStore';

const DesignPrototypeRoute = lazy(() => import('./features/openings').then(m => ({ default: m.DesignPrototypeRoute })));
const GameChecksPage = import.meta.env.DEV
  ? lazy(() => import('./features/openings').then(m => ({ default: m.GameChecksPage })))
  : null;
const TreePage = lazy(() => import('./features/openings').then(m => ({ default: m.TreePage })));
const HomePage = lazy(() => import('./features/openings').then(m => ({ default: m.HomePage })));
const ReviewPage = lazy(() => import('./features/openings').then(m => ({ default: m.ReviewPage })));
const PracticePage = lazy(() => import('./features/openings').then(m => ({ default: m.PracticePage })));

// La v2 est l'application : publiée sous /v2, et sous /dev pendant le développement (workshop/routes.ts).
const HOME = import.meta.env.DEV ? '/dev/home' : '/v2/home';

/** Une adresse inconnue, ou une page de la v1 supprimée, mène à Home ; l'erreur de connexion Lichess y est dite. */
function ToHome() {
  const { search } = useLocation();
  return <Navigate to={`${HOME}${search}`} replace />;
}

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

  const page = (Page: React.ComponentType) => (
    <Suspense fallback={<PageSkeleton />}>
      <Page />
    </Suspense>
  );

  return (
    <div className="app animate-fade-in">
      <Routes>
        <Route path="/v2/home" element={page(HomePage)} />
        <Route path="/v2/tree" element={page(TreePage)} />
        <Route path="/v2/review" element={page(ReviewPage)} />
        <Route path="/v2/practice" element={page(PracticePage)} />
        <Route path="/v2/openings" element={page(DesignPrototypeRoute)} />
        {import.meta.env.DEV && (
          <>
            <Route path="/dev/home" element={page(HomePage)} />
            <Route path="/dev/tree" element={page(TreePage)} />
            <Route path="/dev/review" element={page(ReviewPage)} />
            <Route path="/dev/practice" element={page(PracticePage)} />
            <Route path="/dev/flame-graph" element={page(DesignPrototypeRoute)} />
            {GameChecksPage && <Route path="/dev/games" element={page(GameChecksPage)} />}
          </>
        )}
        <Route path="*" element={<ToHome />} />
      </Routes>
    </div>
  );
}

export default App;
