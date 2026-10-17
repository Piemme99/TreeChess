// PROTOTYPE — données figées, aucun backend. À supprimer avec le reste du dossier.

export const PLAYER = { name: 'Piemme78', platform: 'chess.com', games: 1247, rating: 1764 };

export const FEN_CRITICAL = 'rnb1kbnr/ppp1pppp/8/q7/8/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 4';
export const FEN_BEST = 'rnb1kbnr/ppp1pppp/8/q7/3P4/2N5/PPP2PPP/R1BQKBNR b KQkq d3 0 4';
export const FEN_PLAYED = 'rnb1kbnr/ppp1pppp/8/q7/8/2N2N2/PPPP1PPP/R1BQKB1R b KQkq - 3 4';

export interface Leak {
  id: string;
  opening: string;
  line: string;
  games: number;
  winRate: number;
  pointsLost: number;
  played: string;
  best: string;
  evalPlayed: number;
  evalBest: number;
  verdict: 'leak' | 'deliberate' | 'fine';
  note?: string;
}

export const LEAKS: Leak[] = [
  {
    id: 'scandi',
    opening: 'Scandinave',
    line: '1.e4 d5 2.exd5 Dxd5 3.Cc3 Da5',
    games: 11,
    winRate: 27,
    pointsLost: 3.4,
    played: '4.Cf3',
    best: '4.d4',
    evalPlayed: -0.4,
    evalBest: 0.35,
    verdict: 'leak',
  },
  {
    id: 'morra',
    opening: 'Sicilienne — Gambit Morra',
    line: '1.e4 c5 2.d4 cxd4 3.c3',
    games: 34,
    winRate: 44,
    pointsLost: 2.9,
    played: '3.c3',
    best: '3.Cf3',
    evalPlayed: -0.3,
    evalBest: 0.2,
    verdict: 'deliberate',
    note: 'Gambit joué volontairement, théorique. Ne pas compter comme fuite.',
  },
  {
    id: 'french',
    opening: 'Française — Tarrasch',
    line: '1.e4 e6 2.d4 d5 3.Cd2 Cf6',
    games: 7,
    winRate: 29,
    pointsLost: 2.1,
    played: '4.e5 Cfd7 5.f4',
    best: '4.e5 Cfd7 5.Fd3',
    evalPlayed: -0.2,
    evalBest: 0.3,
    verdict: 'leak',
  },
  {
    id: 'caro',
    opening: 'Caro-Kann — Avance',
    line: '1.e4 c6 2.d4 d5 3.e5 Ff5',
    games: 9,
    winRate: 38,
    pointsLost: 1.6,
    played: '4.Cf3',
    best: '4.Cc3',
    evalPlayed: 0.0,
    evalBest: 0.25,
    verdict: 'leak',
  },
  {
    id: 'openspanish',
    opening: 'Partie italienne',
    line: '1.e4 e5 2.Cf3 Cc6 3.Fc4',
    games: 52,
    winRate: 56,
    pointsLost: 0.4,
    played: '3.Fc4',
    best: '3.Fc4',
    evalPlayed: 0.2,
    evalBest: 0.2,
    verdict: 'fine',
    note: 'Ligne principale, résultats au-dessus de ta moyenne.',
  },
];

export const SCANDI = LEAKS[0];

export interface PastGame {
  id: string;
  opponent: string;
  rating: number;
  result: 'win' | 'loss' | 'draw';
  date: string;
  movesAfter: string;
}

export const SCANDI_GAMES: PastGame[] = [
  { id: 'g1', opponent: 'marek_pl', rating: 1803, result: 'loss', date: '2 oct.', movesAfter: '4...Cf6 5.Fc4 Ff5 6.O-O e6' },
  { id: 'g2', opponent: 'chessfan_84', rating: 1721, result: 'loss', date: '27 sept.', movesAfter: '4...Fg4 5.Fe2 Cc6' },
  { id: 'g3', opponent: 'anna_tactics', rating: 1790, result: 'draw', date: '19 sept.', movesAfter: '4...Cf6 5.d4 c6' },
  { id: 'g4', opponent: 'rook_lifter', rating: 1688, result: 'loss', date: '11 sept.', movesAfter: '4...Fg4 5.h3 Fxf3' },
  { id: 'g5', opponent: 'daniel_vz', rating: 1844, result: 'win', date: '3 sept.', movesAfter: '4...Cc6 5.Fb5 Fd7' },
];

export const ENGINE_LINES = [
  { move: '4.d4', eval: '+0.35', pv: '4.d4 Cf6 5.Cf3 Ff5 6.Fc4 e6 7.Fd2' },
  { move: '4.Fc4', eval: '+0.21', pv: '4.Fc4 Cf6 5.Cf3 Ff5 6.O-O e6' },
  { move: '4.Cf3', eval: '-0.40', pv: '4.Cf3 Fg4 5.Fe2 Cc6 6.d4 O-O-O' },
];

export const GM_GAMES = [
  { white: 'Carlsen, M.', black: 'Jones, G.', result: '1-0', year: 2019, event: 'Tata Steel' },
  { white: 'Caruana, F.', black: 'Nakamura, H.', result: '1/2', year: 2021, event: 'Candidates' },
  { white: 'Firouzja, A.', black: 'Duda, J-K.', result: '1-0', year: 2023, event: 'Norway Chess' },
];

export const PREPARED_ANSWER = { move: '4.d4', line: '4.d4 Cf6 5.Cf3 Ff5 6.Fc4 e6', savedAt: "aujourd'hui" };

export const LAST_GAME = {
  opponent: 'nicolas_b',
  rating: 1842,
  date: 'hier, 21h14',
  result: 'loss' as const,
  divergenceMove: 4,
  played: '4.Cf3',
  prepared: '4.d4',
  daysSincePrep: 6,
};

// Arbre macro : positions posées à la main (viewBox 0 0 920 520).
export interface TreeNode {
  id: string;
  label: string;
  x: number;
  y: number;
  r: number;
  tone: 'root' | 'neutral' | 'leak' | 'deliberate' | 'good';
  leakId?: string;
}

export const TREE_NODES: TreeNode[] = [
  { id: 'root', label: '', x: 60, y: 260, r: 16, tone: 'root' },
  { id: 'e4', label: '1.e4', x: 160, y: 200, r: 26, tone: 'neutral' },
  { id: 'd4', label: '1.d4', x: 150, y: 370, r: 14, tone: 'neutral' },
  { id: 'e5', label: '1...e5', x: 280, y: 110, r: 18, tone: 'neutral' },
  { id: 'c5', label: '1...c5', x: 285, y: 215, r: 20, tone: 'neutral' },
  { id: 'e6', label: '1...e6', x: 275, y: 300, r: 12, tone: 'neutral' },
  { id: 'd5', label: '1...d5', x: 270, y: 390, r: 14, tone: 'neutral' },
  { id: 'c6', label: '1...c6', x: 262, y: 455, r: 11, tone: 'neutral' },
  { id: 'italian', label: '3.Fc4', x: 410, y: 70, r: 15, tone: 'good', leakId: 'openspanish' },
  { id: 'petrov', label: '2...Cf6', x: 400, y: 150, r: 9, tone: 'neutral' },
  { id: 'morra', label: '3.c3', x: 420, y: 215, r: 22, tone: 'deliberate', leakId: 'morra' },
  { id: 'tarrasch', label: '3.Cd2', x: 405, y: 300, r: 14, tone: 'leak', leakId: 'french' },
  { id: 'exd5', label: '2.exd5', x: 400, y: 390, r: 13, tone: 'neutral' },
  { id: 'advance', label: '3.e5', x: 395, y: 455, r: 13, tone: 'leak', leakId: 'caro' },
  { id: 'qa5', label: '3...Da5', x: 530, y: 390, r: 11, tone: 'neutral' },
  { id: 'scandi', label: '4.Cf3', x: 650, y: 390, r: 24, tone: 'leak', leakId: 'scandi' },
  { id: 'd4b', label: '4...Fg4', x: 770, y: 345, r: 8, tone: 'neutral' },
  { id: 'nf6', label: '4...Cf6', x: 775, y: 425, r: 8, tone: 'neutral' },
  { id: 'morra2', label: '3...dxc3', x: 545, y: 200, r: 12, tone: 'neutral' },
  { id: 'morra3', label: '4.Cxc3', x: 650, y: 190, r: 9, tone: 'neutral' },
  { id: 'it2', label: '3...Fc5', x: 530, y: 55, r: 9, tone: 'neutral' },
  { id: 'it3', label: '3...Cf6', x: 530, y: 110, r: 8, tone: 'neutral' },
];

export const TREE_EDGES: [string, string][] = [
  ['root', 'e4'], ['root', 'd4'],
  ['e4', 'e5'], ['e4', 'c5'], ['e4', 'e6'], ['e4', 'd5'], ['e4', 'c6'],
  ['e5', 'italian'], ['e5', 'petrov'],
  ['c5', 'morra'], ['e6', 'tarrasch'], ['d5', 'exd5'], ['c6', 'advance'],
  ['exd5', 'qa5'], ['qa5', 'scandi'], ['scandi', 'd4b'], ['scandi', 'nf6'],
  ['morra', 'morra2'], ['morra2', 'morra3'],
  ['italian', 'it2'], ['italian', 'it3'],
];

// Flame graph : une ligne par profondeur, segments proportionnels au nombre de parties.
export interface FlameSegment {
  id: string;
  label: string;
  width: number;
  offset: number;
  tone: 'neutral' | 'leak' | 'deliberate' | 'good';
  leakId?: string;
}

export const FLAME_ROWS: FlameSegment[][] = [
  [
    { id: 'f-e4', label: '1.e4', width: 78, offset: 0, tone: 'neutral' },
    { id: 'f-d4', label: '1.d4', width: 22, offset: 78, tone: 'neutral' },
  ],
  [
    { id: 'f-e5', label: '1...e5', width: 24, offset: 0, tone: 'neutral' },
    { id: 'f-c5', label: '1...c5', width: 23, offset: 24, tone: 'neutral' },
    { id: 'f-e6', label: '1...e6', width: 12, offset: 47, tone: 'neutral' },
    { id: 'f-d5', label: '1...d5', width: 11, offset: 59, tone: 'neutral' },
    { id: 'f-c6', label: '1...c6', width: 8, offset: 70, tone: 'neutral' },
    { id: 'f-rest', label: '', width: 22, offset: 78, tone: 'neutral' },
  ],
  [
    { id: 'f-it', label: '3.Fc4 — italienne', width: 18, offset: 0, tone: 'good', leakId: 'openspanish' },
    { id: 'f-pet', label: '', width: 6, offset: 18, tone: 'neutral' },
    { id: 'f-morra', label: '3.c3 — Morra', width: 19, offset: 24, tone: 'deliberate', leakId: 'morra' },
    { id: 'f-sic2', label: '', width: 4, offset: 43, tone: 'neutral' },
    { id: 'f-tar', label: '3.Cd2', width: 9, offset: 47, tone: 'leak', leakId: 'french' },
    { id: 'f-fr2', label: '', width: 3, offset: 56, tone: 'neutral' },
    { id: 'f-exd5', label: '2.exd5', width: 11, offset: 59, tone: 'neutral' },
    { id: 'f-adv', label: '3.e5', width: 8, offset: 70, tone: 'leak', leakId: 'caro' },
  ],
  [
    { id: 'f-it2', label: '', width: 18, offset: 0, tone: 'neutral' },
    { id: 'f-morra2', label: '3...dxc3', width: 15, offset: 24, tone: 'neutral' },
    { id: 'f-tar2', label: '', width: 9, offset: 47, tone: 'neutral' },
    { id: 'f-qa5', label: '3...Da5', width: 9, offset: 59, tone: 'neutral' },
    { id: 'f-adv2', label: '3...Ff5', width: 8, offset: 70, tone: 'neutral' },
  ],
  [
    { id: 'f-scandi', label: '4.Cf3 — 11 parties, 27%', width: 9, offset: 59, tone: 'leak', leakId: 'scandi' },
    { id: 'f-adv3', label: '4.Cf3', width: 8, offset: 70, tone: 'leak', leakId: 'caro' },
  ],
];

export const STEPS = [
  { n: 1, key: 'reperer', label: 'Repérer' },
  { n: 2, key: 'comprendre', label: 'Comprendre' },
  { n: 3, key: 'preparer', label: 'Préparer' },
  { n: 4, key: 'verifier', label: 'Vérifier' },
] as const;
