import type { Grade } from '../domain/analysis';
import { COLOURS, REPERTOIRE } from '../workshop/theme';

/** Ce qu'une pastille dit d'un coup de la partie : sa note, son appartenance au répertoire, ou une réponse adverse neuve. */
export type BadgeKind = 'repertoire' | Grade | 'new';

// Glyphe blanc lisible (≥ 3:1) sauf sur l'ambre, trop clair : il y prend le vert du texte. « Correct » est une
// pastille vide, pour ne pas dépendre de la seule couleur face à « good ».
export const BADGES: Record<BadgeKind, { label: string; glyph: string; colour: string; ink?: string; outline?: true }> = {
  repertoire: { label: 'Repertoire', glyph: '', colour: REPERTOIRE },
  best: { label: 'Best', glyph: '★', colour: 'oklch(0.55 0.12 215)' },
  good: { label: 'Good', glyph: '✓', colour: 'oklch(0.56 0.14 140)' },
  correct: { label: 'Correct', glyph: '✓', colour: COLOURS.leafSoft, outline: true },
  inaccuracy: { label: 'Inaccuracy', glyph: '?!', colour: 'oklch(0.80 0.15 85)', ink: COLOURS.leaf },
  mistake: { label: 'Mistake', glyph: '?', colour: 'oklch(0.60 0.16 50)' },
  blunder: { label: 'Blunder', glyph: '??', colour: 'oklch(0.52 0.20 27)' },
  new: { label: 'Not prepared', glyph: 'new', colour: COLOURS.terracotta, outline: true },
};

export const BADGE_ORDER: BadgeKind[] = ['repertoire', 'best', 'good', 'correct', 'inaccuracy', 'mistake', 'blunder', 'new'];
