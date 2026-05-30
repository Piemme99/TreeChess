import type { ArrowAnnotation, SquareHighlightAnnotation } from '../../../../types';

/**
 * Annotation colour palette, matching the Lichess hex values produced by the
 * backend PGN annotation parser so imported and user-drawn annotations are
 * visually identical.
 */
export const ANNOTATION_COLORS = {
  green: '#15781B',
  red: '#882020',
  blue: '#003088',
  yellow: '#e68f00',
} as const;

export interface DrawModifiers {
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

/**
 * Maps keyboard modifiers held while drawing to an annotation colour
 * (Lichess-style): plain = green, shift = red, alt = blue, ctrl = yellow.
 */
export function colorFromModifiers(mods: DrawModifiers): string {
  if (mods.shiftKey) return ANNOTATION_COLORS.red;
  if (mods.altKey) return ANNOTATION_COLORS.blue;
  if (mods.ctrlKey) return ANNOTATION_COLORS.yellow;
  return ANNOTATION_COLORS.green;
}

/**
 * Toggles an arrow between two squares. Drawing the same arrow (same from/to)
 * with the same colour removes it; drawing it with a different colour recolours
 * it; otherwise the arrow is added.
 */
export function toggleArrow(
  arrows: ArrowAnnotation[],
  from: string,
  to: string,
  color: string,
): ArrowAnnotation[] {
  const existing = arrows.find((a) => a.from === from && a.to === to);
  if (existing) {
    if (existing.color === color) {
      return arrows.filter((a) => !(a.from === from && a.to === to));
    }
    return arrows.map((a) => (a.from === from && a.to === to ? { ...a, color } : a));
  }
  return [...arrows, { from, to, color }];
}

/**
 * Toggles a square highlight. Same square + same colour removes it; same square
 * + different colour recolours it; otherwise the highlight is added.
 */
export function toggleHighlight(
  highlights: SquareHighlightAnnotation[],
  square: string,
  color: string,
): SquareHighlightAnnotation[] {
  const existing = highlights.find((h) => h.square === square);
  if (existing) {
    if (existing.color === color) {
      return highlights.filter((h) => h.square !== square);
    }
    return highlights.map((h) => (h.square === square ? { ...h, color } : h));
  }
  return [...highlights, { square, color }];
}
