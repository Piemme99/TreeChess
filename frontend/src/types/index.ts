// Auth types
export type TimeFormat = 'bullet' | 'blitz' | 'rapid';

export interface User {
  id: string;
  username: string;
  email?: string;
  oauthProvider?: string;
  lichessUsername?: string;
  chesscomUsername?: string;
  lichessLinked: boolean;
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
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
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

// Category types
export interface Category {
  id: string;
  name: string;
  color: Color;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryWithRepertoires extends Category {
  repertoires: Repertoire[];
}

export interface CreateCategoryRequest {
  name: string;
  color: Color;
}

export interface UpdateCategoryRequest {
  name: string;
}

export interface AssignCategoryRequest {
  categoryId: string | null;
}

// Annotation types (Lichess study visual annotations)
export interface ArrowAnnotation {
  from: string;
  to: string;
  color: string;
}

export interface SquareHighlightAnnotation {
  square: string;
  color: string;
}

// Repertoire types
export interface RepertoireNode {
  id: string;
  fen: string;
  move: string | null;
  moveNumber: number;
  colorToMove: ShortColor;
  parentId: string | null;
  comment?: string | null;
  arrows?: ArrowAnnotation[];
  highlights?: SquareHighlightAnnotation[];
  branchName?: string | null;
  branchColor?: string | null;
  collapsed?: boolean;
  isMainLine?: boolean;
  transpositionOf?: string | null;
  children: RepertoireNode[];
}

export interface RepertoireMetadata {
  totalNodes: number;
  totalMoves: number;
  deepestDepth: number;
}

export interface RepertoireOrigin {
  type: string;    // 'lichess'
  url?: string;    // e.g. 'https://lichess.org/study/abcdef12'
  creator?: string; // study author username
}

export interface Repertoire {
  id: string;
  name: string;
  description: string;
  color: Color;
  isPublic: boolean;
  categoryId?: string | null;
  treeData: RepertoireNode;
  metadata: RepertoireMetadata;
  origin?: RepertoireOrigin;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

// Starter template with full tree data for the explore page
export interface ExploreTemplate {
  id: string;
  name: string;
  description: string;
  color: Color;
  treeData: RepertoireNode;
  metadata: RepertoireMetadata;
}

// Request types for repertoire management
export interface CreateRepertoireRequest {
  name: string;
  description?: string;
  color: Color;
  isPublic?: boolean;
}

export interface UpdateRepertoireRequest {
  name?: string;
  description?: string;
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

// Training analysis types
export interface TrainingAnalyzeRequest {
  moves: string[];
  userColor: Color;
}

export interface TrainingAnalyzeResponse {
  matchedRepertoire: RepertoireRef | null;
  matchScore: number;
  moves: MoveAnalysis[];
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

export type MoveStatus = 'in-repertoire' | 'out-of-repertoire' | 'opponent-new' | 'out-of-book';

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
export type GameStatus = 'in-repertoire' | 'error' | 'new-line' | 'new-opening';

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

export interface RepertoireFilterOption {
  id: string;
  name: string;
  color: Color;
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

// Dashboard types
export interface RepertoireStats {
  repertoireId: string;
  repertoireName: string;
  color: Color;
  gameCount: number;
  coveragePercent: number;
  winRate: number;
  winRateInRep: number;
  winRateOutRep: number;
  inRepCount: number;
  outRepCount: number;
}

export interface OpponentGap {
  fen: string;
  opponentMove: string;
  frequency: number;
  winRate: number;
  wins: number;
  losses: number;
  draws: number;
  repertoireId: string;
  repertoireName: string;
  color: Color;
  moveNumber: number;
  contextMove: string;
}

export interface BranchStats {
  branchName: string;
  repertoireId: string;
  repertoireName: string;
  color: Color;
  gameCount: number;
  winRate: number;
  wins: number;
  losses: number;
  draws: number;
  errorRate: number;
  errorCount: number;
}

export interface DashboardStatsResponse {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  overallWinRate: number;
  overallCoverage: number;
  winRateInRep: number;
  winRateOutRep: number;
  inRepCount: number;
  outRepCount: number;
  repertoires: RepertoireStats[];
  openingErrorRate: number;
  openingErrorCount: number;
  matchedGamesCount: number;
  opponentGaps: OpponentGap[];
  branchStats: BranchStats[];
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
  importable: boolean;
  skipReason?: string;
}

export interface StudyInfo {
  studyId: string;
  studyName: string;
  ownerName?: string;
  chapters: StudyChapterInfo[];
}

export interface SkippedStudyChapter {
  index: number;
  name: string;
  reason: string;
}

export const STUDY_SKIP_REASON_CUSTOM_STARTING_POSITION = 'custom-starting-position';

export type StudyImportRenameStrategy = 'abort' | 'auto-suffix';

export interface StudyImportRequest {
  studyUrl: string;
  chapters: number[];
  mergeAsOne?: boolean;
  mergeName?: string;
  createCategory?: boolean;
  categoryName?: string;
  includeComments?: boolean;
  includeHints?: boolean;
  ownerName?: string;
  renameStrategy?: StudyImportRenameStrategy;
}

export interface StudyImportResponse {
  repertoires: Repertoire[];
  count: number;
  category?: Category;
  skipped?: SkippedStudyChapter[];
}

export interface RepertoireNameConflict {
  chapterIndex: number;
  chapterName: string;
  targetName: string;
  existingId: string;
  existingColor: string;
}

export interface StudyImportConflictResponse {
  error: string;
  type: 'name-conflict';
  conflicts: RepertoireNameConflict[];
}

// Lichess Study Browser types
export interface LichessStudyOwner {
  id: string;
  name: string;
}

export interface LichessStudyResult {
  id: string;
  name: string;
  liked: boolean;
  likes: number;
  owner: LichessStudyOwner;
  chapters: unknown[];
  topics: string[];
  createdAt: number;
  updatedAt: number;
}

export interface LichessStudyPaginator {
  currentPage: number;
  maxPerPage: number;
  currentPageResults: LichessStudyResult[];
  nbResults: number;
  nbPages: number;
  previousPage: number | null;
  nextPage: number | null;
}

export interface LichessStudySearchResponse {
  paginator: LichessStudyPaginator;
}

export interface LichessTopicsResponse {
  popular: string[];
}

export type StudyBrowseOrder = 'hot' | 'popular' | 'newest';

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
  /** MultiPV line index (1-based). Line 1 is the best move. */
  multipv?: number;
}

export interface EngineState {
  isAnalyzing: boolean;
  currentEvaluation: EngineEvaluation | null;
  /** All MultiPV lines (ordered by line index, best first). Empty when MultiPV=1. */
  currentLines: EngineEvaluation[];
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
  /** MultiPV line index (1-based). Absent when MultiPV=1. */
  multipv?: number;
}

// Helper functions
export function colorToShort(color: Color): ShortColor {
  return color === 'white' ? 'w' : 'b';
}

export function shortToColor(short: ShortColor): Color {
  return short === 'w' ? 'white' : 'black';
}

