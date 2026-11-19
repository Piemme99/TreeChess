import { MotionConfig, motion } from 'framer-motion';
import { Chess } from 'chess.js';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PlayableBoard } from '../board/PlayableBoard';
import { WorkshopBoard } from '../board/WorkshopBoard';
import { ENGINE_DEPTH } from '../checks/useCandidates';
import { judgeGame, type MoveVerdict } from '../domain/analysis';
import type { Evaluation } from '../domain/diagnosis';
import { checkGame, type GameCheck } from '../domain/gameCheck';
import { JUDGEMENT_MARK, type Judgement } from '../domain/judgement';
import { levelLabel } from '../domain/level';
import { evaluationWords, figurine, figurineMove, formatCp } from '../domain/notation';
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

type Mark = { icon: string; colour: string };

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
  const fens = useMemo(() => replayLine(path).fens, [path]);
  const evaluations = useEvaluations(fens, ENGINE_DEPTH);
  const blind = useEngineBlind();
  const verdicts = useMemo(() => judgeGame(path, fens, side, evaluations), [path, fens, side, evaluations]);

  useEffect(() => {
    const step = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setShown((ply) => Math.max(0, ply - 1));
      if (event.key === 'ArrowRight') setShown((ply) => Math.min(path.length, ply + 1));
    };
    window.addEventListener('keydown', step);
    return () => window.removeEventListener('keydown', step);
  }, [path.length]);

  const icon = check.kind === 'followed' ? null : departureMark(check.kind, verdict);
  const mark: Mark | null = icon && { icon, colour: icon === '?' || icon === '!' ? TO_SETTLE : COLOURS.leafSoft };
  const markOf = (ply: number): Mark[] => {
    // L'écart porte déjà sa marque à trancher : « !? » s'y lirait comme un coup intéressant.
    if (ply === departure) return mark ? [mark] : [];
    const inRepertoire = check.kind === 'followed' ? ply < check.plies : ply < check.ply;
    const judgement = verdicts.get(ply)?.judgement;
    return [inRepertoire && IN_REPERTOIRE, judgement && judgementMark(judgement)].filter((each): each is Mark => !!each);
  };

  const summary = (() => {
    if (check.kind === 'followed') return check.plies >= path.length ? 'Prep followed all game' : check.plies ? `Prep followed to move ${Math.ceil(check.plies / 2)}, then nothing prepared` : 'No prep here';
    const played = figurineMove(check.played, check.ply + 1);
    if (check.kind === 'uncovered') return `${played}, no answer yet`;
    // La qualité du coup, c'est l'analyse plus bas qui la dit, face au coup du moteur : une seconde marque, jugée
    // face au répertoire, la contredirait.
    return verdict === 'judging' ? `You played ${played}: the engine is judging it…` : verdict ? `You played ${played}, not ${figurineMove(check.planned[0], check.ply + 1)}` : `New move ${played}, instead of ${figurineMove(check.planned[0], check.ply + 1)}`;
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
        <Analysis side={side} path={path} fens={fens} evaluations={evaluations} verdicts={verdicts} blind={blind} onShow={setShown} />
      </motion.section>
      <LineName path={path.slice(0, shown)} />
      <div className="-mx-2">
        <WorkshopBoard path={path.slice(0, shown)} flipped={side === 'b'} />
      </div>
      {shown > 0 && <ShownMove side={side} path={path} ply={shown - 1} evaluation={evaluations.get(fens[shown])} verdict={verdicts.get(shown - 1)} blind={blind} />}
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

const judgementMark = (judgement: Judgement): Mark => ({ icon: JUDGEMENT_MARK[judgement], colour: TO_SETTLE });

const JUDGEMENT_WORDS: Record<Judgement, [string, string]> = {
  inaccuracy: ['inaccuracy', 'inaccuracies'],
  mistake: ['mistake', 'mistakes'],
  blunder: ['blunder', 'blunders'],
};

/** Ce que le moteur pense des coups du joueur, tous, dans le répertoire comme en dehors. */
function Analysis({ side, path, fens, evaluations, verdicts, blind, onShow }: { side: Side; path: readonly string[]; fens: readonly string[]; evaluations: ReadonlyMap<string, Evaluation>; verdicts: ReadonlyMap<number, MoveVerdict>; blind: boolean; onShow: (plies: number) => void }) {
  const own = side === 'w' ? Math.ceil(path.length / 2) : Math.floor(path.length / 2);
  if (!own) return null;
  const faulted = [...verdicts].filter((entry): entry is [number, MoveVerdict & { judgement: Judgement }] => entry[1].judgement !== null);
  const counts = (['blunder', 'mistake', 'inaccuracy'] as const)
    .map((judgement) => [judgement, faulted.filter(([, verdict]) => verdict.judgement === judgement).length] as const)
    .filter(([, count]) => count)
    .map(([judgement, count]) => `${count} ${JUDGEMENT_WORDS[judgement][count > 1 ? 1 : 0]}`);
  const final = evaluations.get(fens[path.length]);
  const forPlayer = (cp: number) => (side === 'w' ? cp : -cp);
  const headline = (() => {
    if (verdicts.size < own) return blind ? `The engine could judge ${verdicts.size} of your ${own} moves` : `The engine is checking your moves… ${verdicts.size} of ${own}`;
    const yours = own > 1 ? `Your ${own} moves` : 'Your move';
    return `${yours}: ${counts.length ? counts.join(', ') : 'no mistake'}`;
  })();
  return (
    <div className="mt-2 flex flex-col gap-1.5 border-t pt-3" style={{ borderColor: COLOURS.sand }}>
      <span role="status" className="text-[16px] font-bold">
        {headline}
      </span>
      {faulted.length > 0 && (
        <span className="flex flex-wrap gap-1.5">
          {faulted.map(([ply, verdict]) => (
            <motion.button key={ply} type="button" onClick={() => onShow(ply + 1)} whileTap={{ scale: 0.97 }} transition={SPRING} className="rounded-full px-3 py-1 text-[14px] font-bold focus-visible:outline-2" style={tile(COLOURS.sand)}>
              {figurineMove(path[ply], ply + 1)}
              <span style={{ color: TO_SETTLE }}>{JUDGEMENT_MARK[verdict.judgement]}</span>
            </motion.button>
          ))}
        </span>
      )}
      {final && (
        <span className="text-[14px]" style={{ color: COLOURS.leafSoft }}>
          Final position: {formatCp(forPlayer(final.cp))} ({evaluationWords(forPlayer(final.cp))})
        </span>
      )}
    </div>
  );
}

/** Sous l'échiquier : où en est la partie après le coup montré, et pour un coup fautif du joueur, celui du moteur. */
function ShownMove({ side, path, ply, evaluation, verdict, blind }: { side: Side; path: readonly string[]; ply: number; evaluation: Evaluation | undefined; verdict: MoveVerdict | undefined; blind: boolean }) {
  const cp = evaluation && (side === 'w' ? evaluation.cp : -evaluation.cp);
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 px-1 text-[15px]">
      <span className="font-bold">
        {figurineMove(path[ply], ply + 1)}
        {verdict?.judgement && <span style={{ color: TO_SETTLE }}>{JUDGEMENT_MARK[verdict.judgement]}</span>}
      </span>
      <span className="tabular-nums" style={{ color: COLOURS.leafSoft }}>
        {cp === undefined ? (blind ? 'no evaluation' : '…') : `${formatCp(cp)} (${evaluationWords(cp)})`}
      </span>
      {verdict?.better && <span>· {figurineMove(verdict.better, ply + 1)} was better</span>}
    </p>
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

function MoveList({ path, shown, markOf, onShow }: { path: readonly string[]; shown: number; markOf: (ply: number) => Mark[]; onShow: (plies: number) => void }) {
  const rows = Array.from({ length: Math.ceil(path.length / 2) }, (_, index) => index);
  const cell = (ply: number) => {
    if (ply >= path.length) return <span />;
    const marks = markOf(ply);
    return (
      <button
        type="button"
        aria-current={shown === ply + 1 ? 'step' : undefined}
        onClick={() => onShow(ply + 1)}
        className="flex min-h-10 items-center gap-1.5 rounded-xl px-2.5 text-left text-[15px] focus-visible:outline-2"
        style={shown === ply + 1 ? { background: COLOURS.sand, fontWeight: 700 } : undefined}
      >
        <span>{figurine(path[ply])}</span>
        {marks.map((mark) => (
          <span key={mark.icon} aria-label={mark.icon === '✓' ? 'in your repertoire' : undefined} className="font-extrabold" style={{ color: mark.colour }}>
            {mark.icon}
          </span>
        ))}
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
