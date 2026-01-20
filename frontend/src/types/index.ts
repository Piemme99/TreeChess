export type Color = 'w' | 'b';

export type GameResult = '*' | '1-0' | '0-1' | '1/2-1/2';

export interface RepertoireNode {
  id: string;
  fen: string;
  move: string | null;
  moveNumber: number;
  colorToMove: Color;
  parentId: string | null;
  children: RepertoireNode[];
}

export interface Repertoire {
  color: Color;
  root: RepertoireNode;
}

export interface MoveAnalysis {
  move: string;
  fenBefore: string;
  fenAfter: string;
  classification: 'in-repertoire' | 'out-of-repertoire' | 'opponent-new';
}

export interface PgnImport {
  id: string;
  pgn: string;
  importedAt: string;
  analyses: MoveAnalysis[];
}

export interface ApiError {
  message: string;
  code?: string;
}
