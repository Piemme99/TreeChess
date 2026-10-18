import { useEffect, useMemo, useState } from 'react';
import { diagnoseLine, followGame, gameFens, type GameCourse, type LineDiagnosis } from '../domain/diagnosis';
import { linePositions, studyLine, type LinePosition, type StudiedLine } from '../domain/line';
import type { OpeningTree } from '../domain/openingTree';
import { playerAverage } from '../domain/performance';
import type { PlayedGame, Side } from '../domain/playedGame';
import { proposePreparation, type PreparedMove } from '../domain/preparation';
import { replayLine } from '../position/replay';
import { evaluate, useEvaluations } from './engine';
import { explore } from './explorer';

const LINE_DEPTH = 16;
const GAME_DEPTH = 12;
const PREPARATION_DEPTH = 14;
/** Demi-coups suivis après la position clé : les parties s'y décident autour du coup 20. */
export const FOLLOWED_PLIES = 40;
const MAX_GAMES = 20;

export interface Preparation {
  moves: PreparedMove[];
  /** Positions déjà examinées, pour patienter. */
  steps: number;
  done: boolean;
}

export interface LineAnalysis {
  line: StudiedLine;
  positions: LinePosition[];
  average: number;
  /** `fens[ply]` : la position après `ply` demi-coups de la ligne. */
  fens: string[];
  diagnosis: LineDiagnosis;
  /** Position clé, une fois toute la ligne évaluée. */
  key: number | null;
  keyGames: PlayedGame[];
  courses: GameCourse[];
  preparation: Preparation;
}

export function useLineDiagnosis(tree: OpeningTree, games: readonly PlayedGame[], path: readonly string[]): LineAnalysis {
  const line = useMemo(() => studyLine(tree, path), [tree, path]);
  const positions = useMemo(() => linePositions(tree, line), [tree, line]);
  const average = playerAverage(tree);
  const fens = useMemo(() => replayLine(line.steps.map((step) => step.san)).fens, [line]);
  const lineEvaluations = useEvaluations(fens, LINE_DEPTH);
  const diagnosis = useMemo(
    () => diagnoseLine({ positions, steps: line.steps, entry: line.entry, average }, tree.side, lineEvaluations, fens),
    [positions, line, average, tree.side, lineEvaluations, fens],
  );
  const key = diagnosis.complete ? diagnosis.key : null;

  const keyGames = useMemo(() => {
    if (key === null) return [];
    const keyPath = positions[key].path;
    return games
      .filter((game) => game.side === tree.side && keyPath.every((san, index) => game.moves[index] === san))
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
      .slice(0, MAX_GAMES);
  }, [key, positions, games, tree.side]);
  const fensByGame = useMemo(() => keyGames.map((game) => gameFens(game.moves, key ?? 0, FOLLOWED_PLIES)), [keyGames, key]);
  const gameEvaluations = useEvaluations(useMemo(() => fensByGame.flat(), [fensByGame]), GAME_DEPTH, key !== null);
  const courses = keyGames.map((game, index) => followGame(game.moves, key ?? 0, fensByGame[index], tree.side, gameEvaluations));

  const preparation = usePreparation(key === null ? null : positions[key].path, tree.side, keyGames);

  return { line, positions, average, fens, diagnosis, key, keyGames, courses, preparation };
}

function usePreparation(keyPath: readonly string[] | null, side: Side, games: readonly PlayedGame[]): Preparation {
  const [preparation, setPreparation] = useState<Preparation>({ moves: [], steps: 0, done: false });
  useEffect(() => {
    if (!keyPath) return;
    let cancelled = false;
    proposePreparation(keyPath, side, games, {
      explore: (fen) => explore('lichess', fen),
      evaluate: (fen) => evaluate(fen, PREPARATION_DEPTH),
      cancelled: () => cancelled,
      onProgress: (steps) => !cancelled && setPreparation((current) => ({ ...current, steps })),
    }).then((moves) => !cancelled && setPreparation({ moves, steps: 0, done: true }));
    return () => {
      cancelled = true;
    };
  }, [keyPath, side, games]);
  return preparation;
}
