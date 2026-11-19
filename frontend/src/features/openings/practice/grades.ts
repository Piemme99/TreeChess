import type { Grade } from '../domain/analysis';
import { COLOURS, REPERTOIRE } from '../workshop/theme';

/** Ce qu'une pastille dit d'un coup de la partie : sa note, son appartenance au répertoire, ou une réponse adverse neuve. */
export type BadgeKind = 'repertoire' | Grade | 'new';

export const BADGES: Record<BadgeKind, { label: string; glyph: string; colour: string }> = {
  repertoire: { label: 'Repertoire', glyph: '', colour: REPERTOIRE },
  best: { label: 'Best', glyph: '★', colour: 'oklch(0.60 0.12 215)' },
  good: { label: 'Good', glyph: '✓', colour: 'oklch(0.66 0.15 135)' },
  correct: { label: 'Correct', glyph: '✓', colour: 'oklch(0.68 0.02 150)' },
  inaccuracy: { label: 'Inaccuracy', glyph: '?!', colour: 'oklch(0.75 0.15 85)' },
  mistake: { label: 'Mistake', glyph: '?', colour: 'oklch(0.68 0.16 55)' },
  blunder: { label: 'Blunder', glyph: '??', colour: 'oklch(0.56 0.20 27)' },
  new: { label: 'Not prepared', glyph: 'new', colour: COLOURS.terracotta },
};

export const BADGE_ORDER: BadgeKind[] = ['repertoire', 'best', 'good', 'correct', 'inaccuracy', 'mistake', 'blunder', 'new'];
