// Largeur moyenne d'un glyphe de la police mono, en fraction de sa taille.
const MONO_GLYPH_RATIO = 0.62;
const HORIZONTAL_PADDING = 12;

export function labelFits(label: string, barWidthPx: number, fontSizePx: number): boolean {
  return label.length * fontSizePx * MONO_GLYPH_RATIO + HORIZONTAL_PADDING <= barWidthPx;
}
