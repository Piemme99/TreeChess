export function formatMove(san: string, ply: number): string {
  const moveNumber = Math.ceil(ply / 2);
  return ply % 2 === 1 ? `${moveNumber}.${san}` : `${moveNumber}…${san}`;
}

export function formatLine(path: readonly string[]): string {
  return path
    .map((san, index) => {
      const ply = index + 1;
      return ply % 2 === 1 ? formatMove(san, ply) : san;
    })
    .join(' ');
}
