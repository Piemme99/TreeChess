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

const FIGURINES: Record<string, string> = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' };

export const figurine = (text: string) => text.replace(/(^|[\s.…=])([KQRBN])/g, (_, before: string, piece: string) => before + FIGURINES[piece]);

export const figurineMove = (san: string, ply: number) => figurine(formatMove(san, ply));
export const figurineLine = (path: readonly string[]) => figurine(formatLine(path));
