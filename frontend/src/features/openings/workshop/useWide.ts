import { useEffect, useState } from 'react';

const QUERY = '(min-width: 1024px)';
const matches = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;

/**
 * Écran large (ordinateur) ou étroit (téléphone). Ce qui est caché ne doit pas être monté : un échiquier
 * monté sans largeur fait planter react-chessboard dès qu'on lui donne une position.
 */
export function useWide(): boolean {
  const [wide, setWide] = useState(matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(QUERY);
    const change = () => setWide(query.matches);
    query.addEventListener('change', change);
    change();
    return () => query.removeEventListener('change', change);
  }, []);
  return wide;
}
