// PROTOTYPE — constantes et petits hooks des variantes de la vue de ligne. À jeter avec le dossier.
import { useEffect } from 'react';
import { COLOURS } from '../workshop/theme';
import type { Tone } from './study';

export const INK: Record<Tone, string> = {
  losing: COLOURS.terracotta,
  slipping: COLOURS.kumquat,
  even: 'oklch(0.62 0.03 150)',
  winning: 'oklch(0.58 0.11 148)',
};

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
