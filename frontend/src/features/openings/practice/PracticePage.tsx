import { MotionConfig, motion } from 'framer-motion';
import { Chess } from 'chess.js';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PlayableBoard } from '../board/PlayableBoard';
import { WorkshopBoard } from '../board/WorkshopBoard';
import { ENGINE_DEPTH } from '../checks/useCandidates';
import { checkGame, type GameCheck } from '../domain/gameCheck';
import { JUDGEMENT_MARK } from '../domain/judgement';
import { levelLabel } from '../domain/level';
import { figurine, figurineMove } from '../domain/notation';
import type { Side } from '../domain/playedGame';
import { departureMark, opponentTurn, pastLastMove, reviewStart, type DepartureVerdict, type PracticeEnd } from '../domain/practice';
import type { Repertoire } from '../domain/repertoire';
import { useEvaluations } from '../line/engine';
import { explore, lichessSignInUrl, useExplorerSignIn } from '../line/explorer';
import { replayLine } from '../position/replay';
import { useRepertoires } from '../replay/useRepertoires';
import { useEngineBlind } from '../session/useJudgedSteps';
import type { SessionStep } from '../session/steps';
import { judgeStep, verdictFens } from '../session/verdict';
import { useExplorerLevel } from '../source/useExplorerLevel';
import { useSource } from '../source/useSource';
import { LineName } from '../workshop/LineName';
import { useV2Path } from '../workshop/routes';
import { TaskBar } from '../workshop/Task';
import { COLOURS, FONT_FAMILY, raised, REPERTOIRE, SPRING, tile } from '../workshop/theme';
import { useWorkshopFont } from '../workshop/useWorkshopFont';

// Le temps de voir son coup posé avant que l'adversaire réponde.
const REPLY_DELAY = 450;

interface Game {
  path: readonly string[];
  end: PracticeEnd | null;
  /** L'explorateur n'a pas répondu : sans lui, l'adversaire ne sait pas quoi jouer. */
  stuck: boolean;
}

const START: Game = { path: [], end: null, stuck: false };
const sideName = (side: Side) => (side === 'w' ? 'White' : 'Black');
const turnOf = (path: readonly string[]): Side => (path.length % 2 ? 'b' : 'w');
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isOver = (path: readonly string[]) => new Chess(replayLine(path).fens.at(-1)!).isGameOver();

/** La partie après un coup : mat ou pat l'arrête avant toute autre raison. */
const after = (path: readonly string[], end: PracticeEnd | null): Game => ({ path, end: isOver(path) ? 'over' : end, stuck: false });

/** S'entraîner (README, « Practice ») : une partie contre les coups les plus joués au niveau du joueur, puis sa relecture. */
export function PracticePage() {
  useWorkshopFont();
  const source = useSource();
  const { repertoires } = useRepertoires(source.games, source.start);
  const [params] = useSearchParams();
  const side: Side = params.get('side') === 'b' ? 'b' : 'w';
  const level = useExplorerLevel();
  const signIn = useExplorerSignIn();
  const [game, setGame] = useState<Game>(START);
  const [round, setRound] = useState(1);
  const theirTurn = !game.end && !game.stuck && turnOf(game.path) !== side;

  useEffect(() => {
    if (!theirTurn) return;
    let live = true;
    const fen = replayLine(game.path).fens.at(-1)!;
    void Promise.all([explore('lichess', fen, level.opponents), pause(REPLY_DELAY)]).then(([stats]) => {
      if (!live) return;
      if (!stats) return setGame({ ...game, stuck: true });
      const turn = opponentTurn(stats, game.path.length, Math.random());
      setGame(turn.reply ? after([...game.path, turn.reply], turn.end) : { ...game, end: turn.end });
    });
    return () => {
      live = false;
    };
  }, [theirTurn, game, level.opponents]);

  const play = (san: string) => {
    if (game.end || game.stuck || turnOf(game.path) !== side) return;
    const path = [...game.path, san];
    setGame(after(path, pastLastMove(path.length) ? 'move-15' : null));
  };

  const again = () => {
    setGame(START);
    setRound(round + 1);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen pb-16" style={{ fontFamily: FONT_FAMILY, background: COLOURS.cream, color: COLOURS.leaf }}>
        <TaskBar title="Practice" progress={`game ${round} · as ${sideName(side)}`} />
        <main className="mx-auto flex max-w-[30rem] flex-col gap-3 px-4 pt-4">
          {game.end ? (
            <PracticeReview key={round} side={side} path={game.path} end={game.end} repertoire={repertoires[side]} onAgain={again} />
          ) : (
            <>
              <LineName path={game.path} />
              <div className="-mx-2">
                <PlayableBoard path={game.path} flipped={side === 'b'} onMove={play} />
              </div>
              {game.stuck ? (
                <Notice>
                  {signIn ? (
                    <>
                      The replies of your level come from Lichess:{' '}
                      <a href={lichessSignInUrl()} className="underline underline-offset-2">
                        sign in with Lichess
                      </a>
                    </>
                  ) : (
                    'The Lichess explorer does not answer'
                  )}
                  <span className="ml-auto flex gap-2">
                    {!signIn && <Secondary onClick={() => setGame({ ...game, stuck: false })}>Retry</Secondary>}
                    <Secondary onClick={() => setGame({ ...game, end: 'stopped' })}>End</Secondary>
                  </span>
                </Notice>
              ) : (
                <Notice>
                  <span role="status">{theirTurn ? `Their move… · ${levelLabel(level.opponents)} players` : 'Your move'}</span>
                  <span className="ml-auto">
                    <Secondary onClick={() => setGame({ ...game, end: 'stopped' })}>End</Secondary>
                  </span>
                </Notice>
              )}
            </>
          )}
        </main>
      </div>
    </MotionConfig>
  );
}

type Mark = { icon: string; colour: string } | null;

const IN_REPERTOIRE: Mark = { icon: '✓', colour: REPERTOIRE };
const TO_SETTLE = COLOURS.terracotta;

const ENDS: Record<PracticeEnd, string> = {
  rare: 'Ended where fewer than 100 games at your level go on',
  'move-15': 'Ended at move 15',
  over: 'The game is over on the board',
  stopped: 'You ended the game',
};

/** La partie relue coup par coup, marquée comme les parties de Home ; le premier écart dit ce qui attend. */
function PracticeReview({ side, path, end, repertoire, onAgain }: { side: Side; path: readonly string[]; end: PracticeEnd; repertoire: Repertoire; onAgain: () => void }) {
  const pathOf = useV2Path();
  const check = useMemo(() => checkGame(repertoire, { side, moves: [...path], score: 0.5, playedAt: '' }), [repertoire, side, path]);
  const verdict = useDepartureVerdict(side, path, check);
  const departure = check.kind === 'followed' ? -1 : check.ply;
  const [shown, setShown] = useState(() => reviewStart(check, path.length));

  useEffect(() => {
    const step = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setShown((ply) => Math.max(0, ply - 1));
      if (event.key === 'ArrowRight') setShown((ply) => Math.min(path.length, ply + 1));
    };
    window.addEventListener('keydown', step);
    return () => window.removeEventListener('keydown', step);
  }, [path.length]);

  const icon = check.kind === 'followed' ? null : departureMark(check.kind, verdict);
  const mark: Mark = icon && { icon, colour: icon === '?' || icon === '!' ? TO_SETTLE : COLOURS.leafSoft };
  const markOf = (ply: number): Mark => {
    if (ply === departure) return mark;
    const inRepertoire = check.kind === 'followed' ? ply < check.plies : ply < check.ply;
    return inRepertoire ? IN_REPERTOIRE : null;
  };

  const summary = (() => {
    if (check.kind === 'followed') return check.plies >= path.length ? 'Prep followed all game' : check.plies ? `Prep followed to move ${Math.ceil(check.plies / 2)}, then nothing prepared` : 'No prep here';
    const played = figurineMove(check.played, check.ply + 1);
    if (check.kind === 'uncovered') return `${played}, no answer yet`;
    const mark = verdict && verdict !== 'judging' && verdict !== 'blind' ? JUDGEMENT_MARK[verdict] : '';
    return verdict === 'judging' ? `You played ${played}: the engine is judging it…` : verdict ? `You played ${played}${mark}, not ${figurineMove(check.planned[0], check.ply + 1)}` : `New move ${played}, instead of ${figurineMove(check.planned[0], check.ply + 1)}`;
  })();

  return (
    <>
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="flex flex-col gap-1 rounded-3xl px-5 py-4" style={raised(false)}>
        <h1 className="flex items-baseline gap-2 text-[20px] font-extrabold leading-tight tracking-[-0.01em]">
          {mark && (
            <span aria-hidden="true" style={{ color: mark.colour }}>
              {mark.icon}
            </span>
          )}
          <span>{summary}</span>
        </h1>
        <span className="text-[14px]" style={{ color: COLOURS.leafSoft }}>
          {ENDS[end]}
        </span>
      </motion.section>
      <LineName path={path.slice(0, shown)} />
      <div className="-mx-2">
        <WorkshopBoard path={path.slice(0, shown)} flipped={side === 'b'} />
      </div>
      <MoveList path={path} shown={shown} markOf={markOf} onShow={setShown} />
      <div className="mt-2 flex flex-col gap-2">
        <motion.button type="button" onClick={onAgain} whileTap={{ scale: 0.97 }} transition={SPRING} className="min-h-12 rounded-full px-5 text-[15px] font-bold focus-visible:outline-2" style={raised(true)}>
          Practise again
        </motion.button>
        <Link to={pathOf('home')} className="grid min-h-12 place-items-center rounded-full px-5 text-[15px] font-bold focus-visible:outline-2" style={{ ...tile(COLOURS.sand), color: COLOURS.leaf }}>
          Back to Home
        </Link>
      </div>
    </>
  );
}

/** L'avis du moteur sur le coup qui a quitté le répertoire, comme pour un écart en partie. */
function useDepartureVerdict(side: Side, path: readonly string[], check: GameCheck): DepartureVerdict {
  const step = useMemo<SessionStep | null>(
    () =>
      check.kind === 'left'
        ? { key: check.position, side, kind: 'left', path: path.slice(0, check.ply), played: check.played, planned: check.planned, games: [] }
        : null,
    [check, side, path],
  );
  const fens = useMemo(() => (step ? [...verdictFens(step).values()] : []), [step]);
  const evaluations = useEvaluations(fens, ENGINE_DEPTH, step !== null);
  const blind = useEngineBlind();
  if (!step) return null;
  const verdict = judgeStep(step, evaluations);
  if (!verdict) return blind ? 'blind' : 'judging';
  return verdict.judgement;
}

function MoveList({ path, shown, markOf, onShow }: { path: readonly string[]; shown: number; markOf: (ply: number) => Mark; onShow: (plies: number) => void }) {
  const rows = Array.from({ length: Math.ceil(path.length / 2) }, (_, index) => index);
  const cell = (ply: number) => {
    if (ply >= path.length) return <span />;
    const mark = markOf(ply);
    return (
      <button
        type="button"
        aria-current={shown === ply + 1 ? 'step' : undefined}
        onClick={() => onShow(ply + 1)}
        className="flex min-h-10 items-center gap-1.5 rounded-xl px-2.5 text-left text-[15px] focus-visible:outline-2"
        style={shown === ply + 1 ? { background: COLOURS.sand, fontWeight: 700 } : undefined}
      >
        <span>{figurine(path[ply])}</span>
        {mark && (
          <span aria-label={mark.icon === '✓' ? 'in your repertoire' : undefined} className="font-extrabold" style={{ color: mark.colour }}>
            {mark.icon}
          </span>
        )}
      </button>
    );
  };
  return (
    <ol className="grid grid-cols-[2.25rem_1fr_1fr] items-center rounded-2xl px-2 py-1.5" style={tile(COLOURS.paper)}>
      {rows.map((row) => (
        <li key={row} className="contents">
          <span className="pl-1 text-[14px] tabular-nums" style={{ color: COLOURS.leafSoft }}>
            {row + 1}.
          </span>
          {cell(row * 2)}
          {cell(row * 2 + 1)}
        </li>
      ))}
    </ol>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-3 text-[16px] font-bold" style={tile(COLOURS.paper)}>
      {children}
    </div>
  );
}

function Secondary({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <motion.button type="button" onClick={onClick} whileTap={{ scale: 0.97 }} transition={SPRING} className="rounded-full px-4 py-2 text-[14px] font-bold focus-visible:outline-2" style={tile(COLOURS.sand)}>
      {children}
    </motion.button>
  );
}
