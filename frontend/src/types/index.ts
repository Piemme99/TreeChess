// Color types
export type Color = 'white' | 'black';
export type ShortColor = 'w' | 'b';

// Repertoire types
export interface RepertoireNode {
  id: string;
  fen: string;
  move: string | null;
  moveNumber: number;
  colorToMove: ShortColor;
  parentId: string | null;
  children: RepertoireNode[];
}

export interface RepertoireMetadata {
  totalNodes: number;
  totalMoves: number;
  deepestDepth: number;
}

export interface Repertoire {
  id: string;
  color: Color;
  treeData: RepertoireNode;
  metadata: RepertoireMetadata;
  createdAt: string;
  updatedAt: string;
}

// Add node request
export interface AddNodeRequest {
  parentId: string;
  move: string;
  fen: string;
  moveNumber: number;
  colorToMove: ShortColor;
}

// Analysis types
export interface PGNHeaders {
  Event?: string;
  Site?: string;
  Date?: string;
  Round?: string;
  White?: string;
  Black?: string;
  Result?: string;
  ECO?: string;
}

export type MoveStatus = 'in-repertoire' | 'out-of-repertoire' | 'opponent-new';

export interface MoveAnalysis {
  plyNumber: number;
  san: string;
  fen: string;
  status: MoveStatus;
  expectedMove?: string;
  isUserMove: boolean;
}

export interface GameAnalysis {
  gameIndex: number;
  headers: PGNHeaders;
  moves: MoveAnalysis[];
  userColor: Color;
}

export interface AnalysisSummary {
  id: string;
  username: string;
  filename: string;
  gameCount: number;
  uploadedAt: string;
}

export interface AnalysisDetail extends AnalysisSummary {
  results: GameAnalysis[];
}

// API types
export interface ApiError {
  message: string;
  code?: string;
}

export interface UploadResponse {
  id: string;
  username: string;
  filename: string;
  gameCount: number;
}

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// Helper functions
export function colorToShort(color: Color): ShortColor {
  return color === 'white' ? 'w' : 'b';
}

export function shortToColor(short: ShortColor): Color {
  return short === 'w' ? 'white' : 'black';
}
