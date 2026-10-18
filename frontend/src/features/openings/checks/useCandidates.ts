import { Chess } from 'chess.js';
import { useMemo } from 'react';
import { uciToSan, type Evaluation } from '../domain/diagnosis';
import { judgeMove, type Judgement } from '../domain/judgement';
import type { Side } from '../domain/playedGame';
import { useEvaluations } from '../line/engine';
import type { Builder } from './useBuilder';
import { useExplorerAt } from './useExplorerAt';

export const ENGINE_DEPTH = 14;
// Peu de suggestions : trois coups du niveau, le coup du moteur et les siens suffisent à choisir.
const MAX_CANDIDATES = 3;
const MAX_REPLIES = 4;
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
  explorer: 'missing' | 'asking' | 'ready';
}

const afterMove = (fen: string, san: string) => {
  const chess = new Chess(fen);
  chess.move(san);
  return chess.fen();
};

/** Les coups entre lesquels choisir depuis la position courante, avec tout ce qui aide à choisir. */
export function useCandidates(builder: Builder): Candidates {
  const { fen, playerToMove, mine } = builder;
  const side = builder.checked.game.side;
  const explorer = useExplorerAt(fen);

  const hereFens = useMemo(() => [fen], [fen]);
  const here = useEvaluations(hereFens, ENGINE_DEPTH).get(fen);
  const engineSan = playerToMove ? uciToSan(fen, here?.best) : null;

  const base = useMemo(() => {
    const total = explorer ? explorer.white + explorer.draws + explorer.black : 0;
    const known = explorer?.moves ?? [];
    const listed = playerToMove
      ? known.slice(0, MAX_CANDIDATES)
      : known.filter((move) => (move.white + move.draws + move.black) / total >= MIN_REPLY_SHARE).slice(0, MAX_REPLIES);
    const sans = [...listed.map((move) => move.san)];
    for (const san of mine.keys()) if (!sans.includes(san)) sans.push(san);
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
        engine: san === engineSan,
        fen: afterMove(fen, san),
      };
    });
  }, [explorer, playerToMove, mine, engineSan, side, fen]);

  const fens = useMemo(() => base.map((row) => row.fen), [base]);
  const evaluations = useEvaluations(fens, ENGINE_DEPTH);
  const mover: Side = playerToMove ? side : side === 'w' ? 'b' : 'w';

  const all = base.map(({ fen: after, ...row }): Candidate => {
    const cp = evaluations.get(after)?.cp;
    return { ...row, cp, judgement: here && cp !== undefined ? judgeMove(here.cp, cp, mover) : null };
  });
  // On ne recommande pas un coup moyen ou mauvais ; l'adversaire, lui, peut jouer ce qu'il veut.
  const costly = playerToMove ? all.filter((row) => row.judgement) : [];
  return {
    rows: all.filter((row) => !costly.includes(row)),
    costly,
    here: here && { ...here, san: engineSan },
    explorer: explorer === null ? 'missing' : explorer === undefined ? 'asking' : 'ready',
  };
}
