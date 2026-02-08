import { Link } from 'react-router-dom';
import { usePageTitle } from '../../shared/hooks/usePageTitle';

export function NotFoundPage() {
  usePageTitle('Page Not Found');

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg p-4">
      <div className="bg-bg-card rounded-2xl shadow-xl shadow-primary/5 border border-primary/10 p-8 w-full max-w-[400px] text-center">
        <h1 className="text-5xl font-bold font-display mb-2">404</h1>
        <p className="text-text-muted mb-6">Page not found</p>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 font-medium border-none rounded-xl cursor-pointer px-4 py-2 bg-gradient-to-r from-primary to-primary-hover text-white shadow-md shadow-primary/20 no-underline"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
