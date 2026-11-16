import { useEffect } from 'react';
import { useLocation } from 'react-router';

export type V2Page = 'today' | 'review' | 'tree' | 'openings' | 'games';

// En dev, les pages vivent sous /dev ; en prod, sous /v2 (build avec VITE_V2=1). Les liens restent dans l'espace courant.
const DEV: Record<V2Page, string> = { today: '/dev/today', review: '/dev/review', tree: '/dev/tree', openings: '/dev/flame-graph', games: '/dev/games' };

export function useV2Path(): (page: V2Page) => string {
  const { pathname } = useLocation();
  const published = pathname.startsWith('/v2/');
  return (page) => (published ? `/v2/${page}` : DEV[page]);
}

/** Pages de test en prod : joignables par leur adresse, mais hors des moteurs de recherche. */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}
