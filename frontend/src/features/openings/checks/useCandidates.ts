import { Chess } from 'chess.js';
import { useMemo } from 'react';
import { uciToSan, type Evaluation } from '../domain/diagnosis';
import { judgeMove, type Judgement } from '../domain/judgement';
import type { Side } from '../domain/playedGame';
import { useEvaluations } from '../services/engine';
import type { Builder } from './useBuilder';
import { useExplorerAt } from './useExplorerAt';

export const ENGINE_DEPTH = 14;
// Peu de suggestions : trois coups des forts joueurs, le coup du moteur et les siens suffisent à choisir.
const MAX_CANDIDATES = 3;
const MAX_REPLIES = 4;
const MAX_OWN = 3;
// Une réponse adverse plus rare que ça à ton niveau ne vaut pas une ligne ; on peut toujours la jouer.
const MIN_REPLY_SHARE = 0.05;

export interface Candidate {
  san: string;
  /** Part des parties du niveau du joueur ; absente quand l'explorateur ne connaît pas le coup. */
  share?: number;
  /** Score du joueur dans ces parties. */
  score?: number;
  /** Parties du joueur où ce coup a suivi. */
  mine: number;
  /** Son score dans ces parties, de 0 à 1. */
  mineScore?: number;
  /** Évaluation après le coup, centipions des Blancs ; absente tant que le moteur n'a pas répondu. */
  cp?: number;
  judgement: Judgement | null;
  engine: boolean;
}

export interface Candidates {
  rows: Candidate[];
  /** Les coups du joueur que le moteur juge coûteux : pas suggérés, mais jouables sur l'échiquier. */
  costly: Candidate[];
  /** Ce que vaut la position courante et le coup que jouerait le moteur. */
  here?: Evaluation & { san: string | null };
  explorer: 'missing' | 'asking' | 'failed' | 'sign-in' | 'ready';
  /** D'où viennent les statistiques : les forts joueurs (coups du joueur) ou son niveau (réponses adverses). */
  pool: 'strong' | 'level';
}

const afterMove = (fen: string, san: string) => {
  const chess = new Chess(fen);
  chess.move(san);
  return chess.fen();
};

/** Les coups entre lesquels choisir depuis la position courante, avec tout ce qui aide à choisir. */
export function useCandidates(builder: Builder): Candidates {
  const { fen, playerToMove, mine } = builder;
  const side = builder.origin.side;
  // Ses propres coups se choisissent sur ce que jouent les forts joueurs ; les réponses adverses à préparer
  // sont celles des joueurs de son niveau et un peu au-dessus : ceux contre qui il veut se préparer.
  const pool = playerToMove ? 'strong' : 'level';
  const explorer = useExplorerAt(fen, playerToMove ? 'strong' : 'lichess');

  const hereFens = useMemo(() => [fen], [fen]);
  const here = useEvaluations(hereFens, ENGINE_DEPTH).get(fen);
  const engineSan = playerToMove ? uciToSan(fen, here?.best) : null;

  const stats = typeof explorer === 'object' ? explorer : null;
  const base = useMemo(() => {
    const total = stats ? stats.white + stats.draws + stats.black : 0;
    const known = stats?.moves ?? [];
    const listed = playerToMove
      ? known.slice(0, MAX_CANDIDATES)
      : known.filter((move) => (move.white + move.draws + move.black) / total >= MIN_REPLY_SHARE).slice(0, MAX_REPLIES);
    const sans = [...listed.map((move) => move.san)];
    // Ses propres coups les plus joués seulement : une ligne par coup rencontré une fois noierait le choix.
    const habits = [...mine.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_OWN).map(([san]) => san);
    for (const san of habits) if (!sans.includes(san)) sans.push(san);
    // La réponse de la partie qui a soulevé la question figure toujours au tableau.
    const reply = builder.origin.reply;
    if (reply && builder.path.length === builder.start.length && !sans.includes(reply)) sans.push(reply);
    if (engineSan && !sans.includes(engineSan)) sans.push(engineSan);
    return sans.map((san) => {
      const stats = known.find((move) => move.san === san);
      const games = stats ? stats.white + stats.draws + stats.black : 0;
      const wins = stats ? (side === 'w' ? stats.white : stats.black) : 0;
      return {
        san,
        share: stats ? games / total : undefined,
        score: stats ? (wins + stats.draws / 2) / games : undefined,
        mine: mine.get(san) ?? 0,
        mineScore: mine.get(san) ? (builder.minePoints.get(san) ?? 0) / mine.get(san)! : undefined,
        engine: san === engineSan,
        fen: afterMove(fen, san),
      };
    });
  }, [stats, playerToMove, mine, engineSan, side, fen, builder.origin.reply, builder.path.length, builder.start.length, builder.minePoints]);

  const fens = useMemo(() => base.map((row) => row.fen), [base]);
  const evaluations = useEvaluations(fens, ENGINE_DEPTH);
  const mover: Side = playerToMove ? side : side === 'w' ? 'b' : 'w';

  const evaluated = base.map(({ fen: after, ...row }): Candidate => {
    const cp = evaluations.get(after)?.cp;
    return { ...row, cp, judgement: here && cp !== undefined ? judgeMove(here.cp, cp, mover) : null };
  });
  // Le badge « engine » suit la colonne : le meilleur coup du tableau, ex aequo compris. Le coup proposé par
  // l'analyse de la position seule pouvait contredire les évaluations affichées, calculées coup par coup.
  const forMover = (cp: number) => (mover === 'w' ? cp : -cp);
  const scored = evaluated.filter((row) => row.cp !== undefined);
  const top = playerToMove && scored.length === evaluated.length && scored.length > 0 ? Math.max(...scored.map((row) => forMover(row.cp!))) : undefined;
  const all = evaluated.map((row) => ({ ...row, engine: top === undefined ? row.engine : forMover(row.cp!) >= top - 5 }));
  // On ne recommande pas un coup moyen ou mauvais ; l'adversaire, lui, peut jouer ce qu'il veut.
  const costly = playerToMove ? all.filter((row) => row.judgement) : [];
  return {
    rows: all.filter((row) => !costly.includes(row)),
    costly,
    here: here && { ...here, san: engineSan },
    explorer: explorer === undefined ? 'asking' : typeof explorer === 'string' ? explorer : 'ready',
    pool,
  };
}
