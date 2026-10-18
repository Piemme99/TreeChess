// PROTOTYPE — constantes et petits hooks des variantes de la vue de ligne. À jeter avec le dossier.
import { useEffect } from 'react';
import { COLOURS } from '../workshop/theme';
import type { Tone } from './study';

export const INK: Record<Tone, string> = {
  losing: COLOURS.terracotta,
  slipping: COLOURS.kumquatDeep,
  even: 'oklch(0.45 0.03 60)',
  winning: 'oklch(0.50 0.12 148)',
};

// Au-delà de trois flèches, le plateau devient illisible : la ligne, puis les coups les plus joués.
const MAX_ARROWS = 3;

export function arrowMoves<T extends { onLine: boolean }>(moves: readonly T[]): T[] {
  const onLine = moves.filter((move) => move.onLine);
  return [...onLine, ...moves.filter((move) => !move.onLine)].slice(0, MAX_ARROWS);
}

/** ↑ ↓ et ← → déplacent le curseur sur la ligne ; ← → servent aussi au prototype, d'où [ ] pour la barre. */
export function useStepKeys(focus: number, max: number, onFocus: (ply: number) => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') onFocus(Math.max(0, focus - 1));
      else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') onFocus(Math.min(max, focus + 1));
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus, max, onFocus]);
}

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

// Lichess plutôt que chess.com : gratuit, libre, et l'analyse y marche sans compte.
export function lichessPosition(fen: string, black: boolean) {
  return `https://lichess.org/analysis/standard/${fen.replaceAll(' ', '_')}${black ? '?color=black' : ''}`;
}

/** La partie entière dans l'analyse Lichess, ouverte au demi-coup donné. */
export function lichessGame(moves: readonly string[], ply: number, black: boolean) {
  return `https://lichess.org/analysis/pgn/${moves.map(encodeURIComponent).join('_')}${black ? '?color=black' : ''}#${ply}`;
}
