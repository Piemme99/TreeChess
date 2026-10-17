// PROTOTYPE — matières et lumière partagées par la direction « Clubhouse ».
// Une seule source de lumière, en haut à gauche : toutes les ombres partent vers le bas à droite.

const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/**
 * Fil du bois : un bruit étiré dans un sens, seuillé pour donner des veines plutôt qu'un voile.
 * `along` donne la direction des veines.
 */
export function grain(along: 'x' | 'y', { size = 160, seed = 3, strength = 0.5, scale = 1 } = {}) {
  const [fx, fy] = along === 'x' ? [0.006 / scale, 0.22 / scale] : [0.22 / scale, 0.006 / scale];
  return svgUrl(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>` +
      `<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='${fx} ${fy}' numOctaves='3' seed='${seed}' stitchTiles='stitch'/>` +
      `<feColorMatrix values='0 0 0 0 0.18 0 0 0 0 0.09 0 0 0 0 0.03 ${2.2 * strength} 0 0 0 ${-0.75 * strength}'/></filter>` +
      `<rect width='100%' height='100%' filter='url(#g)'/></svg>`,
  );
}

export const FIBRE = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>` +
    `<filter id='f'><feTurbulence type='fractalNoise' baseFrequency='1.3' numOctaves='3' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 0 0 0 0 0 0.04 0 0 0 0 0 0 0 0 0.32 0'/></filter>` +
    `<rect width='100%' height='100%' filter='url(#f)'/></svg>`,
);

export const PAPER = svgUrl(
  `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>` +
    `<filter id='p'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 0.45 0 0 0 0 0.35 0 0 0 0 0.2 0 0 0 0.16 0'/></filter>` +
    `<rect width='100%' height='100%' filter='url(#p)'/></svg>`,
);

export const SHADOW = {
  object: '6px 16px 30px -10px oklch(0.14 0.04 40 / 0.6), 1px 2px 3px oklch(0.14 0.04 40 / 0.35)',
  resting: '1px 2px 2px -0.5px oklch(0.14 0.04 40 / 0.45)',
  lifted: '4px 10px 14px -5px oklch(0.14 0.04 40 / 0.55)',
  bevel: 'inset 1px 1px 0 oklch(1 0 0 / 0.32), inset -1px -1px 0 oklch(0 0 0 / 0.22)',
  recessed: 'inset 3px 6px 14px oklch(0 0 0 / 0.45), inset -1px -1px 0 oklch(1 0 0 / 0.08)',
};

export const WOOD = {
  maple: 'oklch(0.85 0.065 80)',
  walnut: 'oklch(0.50 0.085 52)',
  walnutDeep: 'oklch(0.36 0.07 45)',
  frame: 'oklch(0.32 0.065 42)',
};
