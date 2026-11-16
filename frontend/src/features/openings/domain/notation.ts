import { MATE_CP } from './diagnosis';

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

/** Centipions, comme sur Lichess : « −0.5 », « +1.2 », « #». */
export function formatCp(cp: number): string {
  if (Math.abs(cp) >= MATE_CP) return cp > 0 ? '#' : '−#';
  const pawns = (Math.abs(cp) / 100).toFixed(1);
  if (pawns === '0.0') return '0.0';
  return cp < 0 ? `−${pawns}` : `+${pawns}`;
}
