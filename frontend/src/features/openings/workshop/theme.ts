import type { CSSProperties } from 'react';
import type { Transition } from 'framer-motion';
import type { Tone } from '../flame/tone';

// Direction « Workshop », retenue le 17/10/2026 (design-prototype/NOTES.md).
export const COLOURS = {
  cream: 'oklch(0.962 0.028 85)',
  paper: 'oklch(0.985 0.012 85)',
  sand: 'oklch(0.915 0.035 80)',
  leaf: 'oklch(0.33 0.06 150)',
  leafSoft: 'oklch(0.50 0.05 150)',
  kumquat: 'oklch(0.73 0.17 55)',
  kumquatDeep: 'oklch(0.60 0.17 45)',
  terracotta: 'oklch(0.60 0.155 35)',
  apricot: 'oklch(0.84 0.11 70)',
  sage: 'oklch(0.72 0.09 145)',
  opponent: 'oklch(0.925 0.025 82)',
};

// Palette « Verger » (18/10/2026) : le plateau reprend le vert du texte, le coup joué le kumquat.
// Le vert des cases reste moins saturé que `sage`, qui signale une ligne solide.
export const BOARD = {
  frame: COLOURS.leaf,
  light: 'oklch(0.94 0.03 85)',
  dark: 'oklch(0.60 0.05 150)',
  markLight: 'oklch(0.86 0.12 70)',
  markDark: 'oklch(0.70 0.14 58)',
};

export const TONES: Record<Tone, { bg: string; fg: string; label: string }> = {
  losing: { bg: COLOURS.terracotta, fg: 'white', label: 'leaking' },
  slipping: { bg: COLOURS.apricot, fg: COLOURS.leaf, label: 'shaky' },
  // La moyenne et le solide reculent vers le papier : la question est où les points fuient.
  even: { bg: 'oklch(0.975 0.012 85)', fg: COLOURS.leafSoft, label: 'par' },
  winning: { bg: 'oklch(0.88 0.045 145)', fg: 'oklch(0.32 0.05 150)', label: 'solid' },
};

// Amortissements proches du critique : un rebond visible, répété à chaque survol, donne la nausée.
export const SPRING: Transition = { type: 'spring', stiffness: 420, damping: 32 };
export const ZOOM: Transition = { type: 'spring', stiffness: 190, damping: 28, mass: 1 };
export const PIECE: Transition = { type: 'tween', duration: 0.18, ease: [0.22, 1, 0.36, 1] };

export const FONT_FAMILY = "'Bricolage Grotesque', system-ui, sans-serif";

export const tile = (bg: string): CSSProperties => ({
  background: bg,
  boxShadow: 'inset 0 1.5px 0 oklch(1 0 0 / 0.45), inset 0 -2px 0 oklch(0 0 0 / 0.12), 0 1px 2px oklch(0.3 0.05 60 / 0.15)',
});

export const raised = (selected: boolean): CSSProperties =>
  selected
    ? { background: COLOURS.leaf, color: COLOURS.cream, boxShadow: '0 14px 28px -10px oklch(0.3 0.06 150 / 0.55)' }
    : {
        background: COLOURS.paper,
        color: COLOURS.leaf,
        boxShadow: '0 1px 0 oklch(1 0 0 / 0.8) inset, 0 2px 6px -2px oklch(0.35 0.06 60 / 0.2)',
      };
