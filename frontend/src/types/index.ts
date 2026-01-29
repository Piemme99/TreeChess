// Auth types
export interface User {
  id: string;
  username: string;
  createdAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

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
  name: string;
  color: Color;
  treeData: RepertoireNode;
  metadata: RepertoireMetadata;
  createdAt: string;
  updatedAt: string;
}

// Request types for repertoire management
export interface CreateRepertoireRequest {
  name: string;
  color: Color;
}

export interface UpdateRepertoireRequest {
  name: string;
}

// Lightweight reference to a repertoire
export interface RepertoireRef {
  id: string;
  name: string;
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
  matchedRepertoire?: RepertoireRef | null;
  matchScore?: number;
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

// Game list types
export type GameStatus = 'ok' | 'error' | 'new-line';

export interface GameSummary {
  analysisId: string;
  gameIndex: number;
  white: string;
  black: string;
  result: string;
  date: string;
  userColor: Color;
  status: GameStatus;
  importedAt: string;
}

export interface GamesResponse {
  games: GameSummary[];
  total: number;
  limit: number;
  offset: number;
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
  source?: 'lichess' | 'chesscom' | 'pgn';
}

// Lichess import types
export interface LichessImportOptions {
  max?: number;
  since?: number;
  until?: number;
  rated?: boolean;
  perfType?: 'bullet' | 'blitz' | 'rapid' | 'classical';
}

// Chess.com import types
export interface ChesscomImportOptions {
  max?: number;
  since?: number;
  until?: number;
  timeClass?: 'daily' | 'rapid' | 'blitz' | 'bullet';
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

// Stockfish engine types
export interface EngineEvaluation {
  score: number;
  mate?: number;
  depth: number;
  bestMove?: string;
  bestMoveFrom?: string;
  bestMoveTo?: string;
  pv: string[];
}

export interface EngineState {
  isAnalyzing: boolean;
  currentEvaluation: EngineEvaluation | null;
  currentFEN: string;
  error: string | null;
}

export interface UCIInfo {
  depth: number;
  score?: number;
  scoreMate?: number;
  bestMove?: string;
  ponder?: string;
  pv: string[];
  nps?: number;
  time?: number;
  nodes?: number;
}

// Video import types
export type VideoImportStatus = 'pending' | 'downloading' | 'extracting' | 'recognizing' | 'building_tree' | 'completed' | 'failed' | 'cancelled';

export interface VideoImport {
  id: string;
  youtubeUrl: string;
  youtubeId: string;
  title: string;
  status: VideoImportStatus;
  progress: number;
  errorMessage?: string;
  totalFrames?: number;
  processedFrames: number;
  createdAt: string;
  completedAt?: string;
}

export interface VideoPosition {
  id: string;
  videoImportId: string;
  fen: string;
  timestampSeconds: number;
  frameIndex: number;
  confidence?: number;
  createdAt: string;
}

export interface SSEProgressEvent {
  status: VideoImportStatus;
  progress: number;
  message: string;
  processedFrames?: number;
  totalFrames?: number;
}

export interface VideoTreeResponse {
  treeData: RepertoireNode;
  color: Color;
}

export interface VideoSearchResult {
  videoImport: VideoImport;
  positions: VideoPosition[];
}

export interface VideoImportSaveRequest {
  name: string;
  color: Color;
  repertoireId?: string;
  treeData: RepertoireNode;
}
