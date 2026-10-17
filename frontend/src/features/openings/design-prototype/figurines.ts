// PROTOTYPE — notation à figurines, comme dans les livres d'échecs (♘f3 plutôt que Nf3).
import { formatLine, formatMove } from '../domain/notation';

const FIGURINES: Record<string, string> = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' };

const figurine = (text: string) => text.replace(/(^|[\s.…=])([KQRBN])/g, (_, before: string, piece: string) => before + FIGURINES[piece]);

export const figurineMove = (san: string, ply: number) => figurine(formatMove(san, ply));
export const figurineLine = (path: readonly string[]) => figurine(formatLine(path));
