// Auth types
export type TimeFormat = 'bullet' | 'blitz' | 'rapid';

export interface User {
  id: string;
  username: string;
  oauthProvider?: string;
  lichessUsername?: string;
  chesscomUsername?: string;
  lastLichessSyncAt?: string;
  lastChesscomSyncAt?: string;
  timeFormatPrefs?: TimeFormat[];
  createdAt: string;
}

export interface SyncResult {
  lichessGamesImported: number;
  chesscomGamesImported: number;
  lichessError?: string;
  chesscomError?: string;
}

export interface UpdateProfileRequest {
  lichessUsername?: string;
  chesscomUsername?: string;
  timeFormatPrefs?: TimeFormat[];
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
  comment?: string | null;
  branchName?: string | null;
  collapsed?: boolean;
  transpositionOf?: string | null;
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
  Opening?: string;
  ECOUrl?: string;
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

export type TimeClass = 'bullet' | 'blitz' | 'rapid' | 'daily';

export type GameSource = 'lichess' | 'chesscom' | 'pgn';

export interface GameSummary {
  analysisId: string;
  gameIndex: number;
  white: string;
  black: string;
  result: string;
  date: string;
  userColor: Color;
  status: GameStatus;
  timeClass?: TimeClass;
  opening?: string;
  importedAt: string;
  repertoireName?: string;
  repertoireId?: string;
  source: GameSource;
  synced: boolean;
}

export interface GamesResponse {
  games: GameSummary[];
  total: number;
  limit: number;
  offset: number;
}

// Insights types
export interface GameRef {
  analysisId: string;
  gameIndex: number;
  plyNumber: number;
  white: string;
  black: string;
  result: string;
  date: string;
}

export interface OpeningMistake {
  fen: string;
  playedMove: string;
  bestMove: string;
  winrateDrop: number;
  frequency: number;
  score: number;
  games: GameRef[];
}

export interface InsightsResponse {
  worstMistakes: OpeningMistake[];
  engineAnalysisDone: boolean;
  engineAnalysisTotal: number;
  engineAnalysisCompleted: number;
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

// Lichess Study import types
export interface StudyChapterInfo {
  index: number;
  name: string;
  orientation: string;
  moveCount: number;
}

export interface StudyInfo {
  studyId: string;
  studyName: string;
  chapters: StudyChapterInfo[];
}

export interface StudyImportRequest {
  studyUrl: string;
  chapters: number[];
  mergeAsOne?: boolean;
  mergeName?: string;
}

export interface StudyImportResponse {
  repertoires: Repertoire[];
  count: number;
}

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// Engine types (browser-side Stockfish WASM for repertoire editor)
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

// Helper functions
export function colorToShort(color: Color): ShortColor {
  return color === 'white' ? 'w' : 'b';
}

export function shortToColor(short: ShortColor): Color {
  return short === 'w' ? 'white' : 'black';
}

