import { MotionConfig, motion } from 'framer-motion';
import { Chess } from 'chess.js';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PlayableBoard } from '../board/PlayableBoard';
import { WorkshopBoard } from '../board/WorkshopBoard';
import { BuildSession } from '../checks/BuildSession';
import { liveGames } from '../checks/decisions';
import { ENGINE_DEPTH } from '../checks/useCandidates';
import type { BuildOrigin } from '../checks/useBuilder';
import type { AddedMove, Addition } from '../domain/addition';
import { judgeGame, type MoveVerdict } from '../domain/analysis';
import type { Evaluation } from '../domain/diagnosis';
import { checkGame, type GameCheck } from '../domain/gameCheck';
import type { Judgement } from '../domain/judgement';
import { levelLabel } from '../domain/level';
import { evaluationWords, figurine, figurineMove, formatCp } from '../domain/notation';
import { gamesOfLastMonths } from '../domain/period';
import type { PlayedGame, Side } from '../domain/playedGame';
import { departureMark, lapseOf, opponentTurn, pastLastMove, practiceStep, reviewStart, startingLine, type DepartureVerdict, type PracticeEnd, type PracticeStep } from '../domain/practice';
import { gamesUntil } from '../domain/replay';
import type { Repertoire } from '../domain/repertoire';
import { useEvaluations } from '../line/engine';
import { explore, lichessSignInUrl, useExplorerSignIn } from '../line/explorer';
import { replayLine } from '../position/replay';
import { useRepertoires } from '../replay/useRepertoires';
import { useReplayDay } from '../replay/useReplayDay';
import { useStoppedMoves } from '../replay/useStoppedMoves';
import { useReview } from '../review/useReview';
import { useEngineBlind } from '../session/useJudgedSteps';
import type { SessionStep } from '../session/steps';
import { judgeStep, verdictFens } from '../session/verdict';
import { useExplorerLevel } from '../source/useExplorerLevel';
import { useSource } from '../source/useSource';
import { LineName } from '../workshop/LineName';
import { useV2Path } from '../workshop/routes';
import { TaskBar } from '../workshop/Task';
import { Toast } from '../workshop/Toast';
import { useToast } from '../workshop/useToast';
import { COLOURS, FONT_FAMILY, raised, REPERTOIRE, SPRING, tile } from '../workshop/theme';
import { useWorkshopFont } from '../workshop/useWorkshopFont';
import { Badge } from './Badge';
import { BADGE_ORDER, BADGES, type BadgeKind } from './grades';

// Le temps de voir son coup posé avant que l'adversaire réponde.
const REPLY_DELAY = 450;
const HABIT_MONTHS = 12;

interface Game {
  path: readonly string[];
  end: PracticeEnd | null;
  /** L'explorateur n'a pas répondu : sans lui, l'adversaire ne sait pas quoi jouer. */
  stuck: boolean;
}

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
  const replay = useReplayDay(source.games, source.firstDay, source.replay);
  const { repertoires, repertoireOn, add, remove } = useRepertoires(source.games, source.start);
  const known = useMemo(() => gamesUntil(source.games, replay.day), [source.games, replay.day]);
  const { reviewed } = useStoppedMoves(repertoires, known, source.start);
  const lived = useMemo(() => liveGames(source.games, repertoireOn, source.firstDay, replay.day), [source, repertoireOn, replay.day]);
  const review = useReview(source.games, reviewed, lived, replay.today, source.start);
  const habits = useMemo(() => gamesOfLastMonths(known, HABIT_MONTHS, new Date(replay.day)), [known, replay.day]);
  const [params] = useSearchParams();
  const side: Side = params.get('side') === 'b' ? 'b' : 'w';
  const level = useExplorerLevel();
  const signIn = useExplorerSignIn();
  // « Practise from here » sur l'arbre : la partie part de la position regardée.
  const line = params.get('line');
  const start = useMemo(() => after(startingLine(line), null), [line]);
  const [game, setGame] = useState<Game>(start);
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
    setGame(start);
    setRound(round + 1);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen pb-16" style={{ fontFamily: FONT_FAMILY, background: COLOURS.cream, color: COLOURS.leaf }}>
        <TaskBar title="Practice" progress={`game ${round} · as ${sideName(side)}`} />
        <main className="mx-auto flex max-w-[30rem] flex-col gap-3 px-4 pt-4">
          {game.end ? (
            <PracticeReview
              key={round}
              side={side}
              path={game.path}
              from={start.path.length}
              end={game.end}
              repertoire={repertoires[side]}
              habits={habits}
              day={replay.day}
              onAdd={add}
              onUndo={remove}
              onLapse={(position) => review.missedInPractice(side, position)}
              onAgain={again}
            />
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

const TO_SETTLE = COLOURS.terracotta;

const ENDS: Record<PracticeEnd, string> = {
  rare: 'Ended where fewer than 100 games at your level go on',
  'move-15': 'Ended at move 15',
  over: 'The game is over on the board',
  stopped: 'You ended the game',
};

/** La partie relue coup par coup, marquée comme les parties de Home ; le premier écart dit ce qui attend. */
interface ReviewProps {
  side: Side;
  path: readonly string[];
  /** Le premier demi-coup joué : ceux d'avant viennent de l'arbre. */
  from: number;
  end: PracticeEnd;
  repertoire: Repertoire;
  /** Les parties du joueur des douze derniers mois : ses habitudes, pour préparer une réponse. */
  habits: readonly PlayedGame[];
  day: string;
  onAdd: (addition: Addition) => void;
  onUndo: (addition: Addition) => void;
  onLapse: (position: string) => void;
  onAgain: () => void;
}

function PracticeReview({ side, path, from, end, repertoire, habits, day, onAdd, onUndo, onLapse, onAgain }: ReviewProps) {
  const pathOf = useV2Path();
  // Le répertoire de la partie, pas celui d'après : un ajout depuis la relecture ne doit pas déplacer l'écart.
  const [check] = useState(() => checkGame(repertoire, { side, moves: [...path], score: 0.5, playedAt: '' }));
  const step = useMemo(() => practiceStep(check, path, side), [check, path, side]);
  const verdict = useDepartureVerdict(side, path, check);
  const departure = step?.ply ?? -1;
  const [settled, setSettled] = useState<string | null>(null);
  const [building, setBuilding] = useState<BuildOrigin | null>(null);
  const { toast, show, close } = useToast();
  const lapsed = useRef(false);
  useEffect(() => {
    const lapse = lapseOf(step, from);
    if (!lapse || lapsed.current) return;
    lapsed.current = true;
    onLapse(lapse);
  }, [step, from, onLapse]);
  const [shown, setShown] = useState(() => reviewStart(check, path.length));
  const fens = useMemo(() => replayLine(path).fens, [path]);
  const evaluations = useEvaluations(fens, ENGINE_DEPTH);
  const blind = useEngineBlind();
  const verdicts = useMemo(() => judgeGame(path, fens, side, evaluations, from), [path, fens, side, evaluations, from]);

  useEffect(() => {
    // Le constructeur a ses propres flèches : la relecture cachée dessous ne doit pas bouger avec elles.
    if (building) return;
    const step = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setShown((ply) => Math.max(0, ply - 1));
      if (event.key === 'ArrowRight') setShown((ply) => Math.min(path.length, ply + 1));
    };
    window.addEventListener('keydown', step);
    return () => window.removeEventListener('keydown', step);
  }, [path.length, building]);

  const icon = step ? departureMark(step.kind === 'uncovered' ? 'uncovered' : 'left', step.kind === 'left' ? verdict : null) : null;
  const mark: Mark | null = icon && { icon, colour: icon === '?' || icon === '!' ? TO_SETTLE : COLOURS.leafSoft };
  const badgesOf = (ply: number): BadgeKind[] => {
    if (ply === departure && step?.kind === 'uncovered') return ['new'];
    const verdict = verdicts.get(ply);
    if (ply >= (step?.ply ?? path.length)) return verdict ? [verdict.grade] : [];
    // Dans le répertoire, seule une faute mérite une seconde pastille : « meilleur » n'y apprendrait rien.
    return verdict?.judgement ? ['repertoire', verdict.judgement] : ['repertoire'];
  };

  const summary = (() => {
    if (!step) return 'Prep followed all game';
    const played = figurineMove(step.played, step.ply + 1);
    if (step.kind === 'uncovered') return `${played}, no answer yet`;
    if (step.kind === 'past') return `${played}, past your prep`;
    // La qualité du coup, c'est l'analyse plus bas qui la dit, face au coup du moteur : une seconde marque, jugée
    // face au répertoire, la contredirait.
    return verdict === 'judging' ? `You played ${played}: the engine is judging it…` : verdict ? `You played ${played}, not ${figurineMove(step.planned[0], step.ply + 1)}` : `New move ${played}, instead of ${figurineMove(step.planned[0], step.ply + 1)}`;
  })();

  const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const settle = (text: string, addition?: Addition) => {
    if (addition) onAdd(addition);
    setSettled(text);
    if (building) toTop();
    setBuilding(null);
    show({
      text,
      undo: () => {
        if (addition) onUndo(addition);
        setSettled(null);
      },
    });
  };
  const addition = (moves: AddedMove[]): Addition => ({ side, addedAt: day, moves });
  const actions: SettleActions | null = step && {
    add: () => settle(`${figurineMove(step.played, step.ply + 1)} added to your repertoire`, addition([{ position: step.position, san: step.played, source: 'habit' }])),
    // Un écart posé par l'arbre n'est pas un oubli : il ne revient pas en révision.
    keep: () => settle(`Kept ${step.planned.map((san) => figurineMove(san, step.ply + 1)).join(' · ')}${lapseOf(step, from) ? ' · back in your review' : ''}`),
    leave: () => settle(step.kind === 'uncovered' ? `${figurineMove(step.played, step.ply + 1)} left unprepared` : 'Repertoire unchanged'),
    build: () => {
      setBuilding(originFor(step, path, side));
      toTop();
    },
  };

  if (building) {
    return (
      <BuildSession
        origin={building}
        games={habits.filter((game) => game.side === side)}
        repertoire={repertoire}
        onAccept={(moves) => settle(`${moves.length} ${moves.length === 1 ? 'move' : 'moves'} added to your repertoire`, addition(moves))}
        onCancel={() => {
          setBuilding(null);
          toTop();
        }}
        stacked
      />
    );
  }

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
        {step && actions && <Settle step={step} verdict={verdict} settled={settled} actions={actions} />}
        <Analysis side={side} path={path} from={from} fens={fens} evaluations={evaluations} verdicts={verdicts} blind={blind} onShow={setShown} />
      </motion.section>
      <LineName path={path.slice(0, shown)} />
      <div className="-mx-2">
        <WorkshopBoard path={path.slice(0, shown)} flipped={side === 'b'} />
      </div>
      {shown > 0 && <ShownMove side={side} path={path} ply={shown - 1} badges={badgesOf(shown - 1)} evaluation={evaluations.get(fens[shown])} verdict={verdicts.get(shown - 1)} blind={blind} />}
      <MoveList path={path} shown={shown} badgesOf={badgesOf} onShow={setShown} />
      <div className="mt-2 flex flex-col gap-2">
        <motion.button type="button" onClick={onAgain} whileTap={{ scale: 0.97 }} transition={SPRING} className="min-h-12 rounded-full px-5 text-[15px] font-bold focus-visible:outline-2" style={raised(true)}>
          Practise again
        </motion.button>
        <Link to={pathOf('home')} className="grid min-h-12 place-items-center rounded-full px-5 text-[15px] font-bold focus-visible:outline-2" style={{ ...tile(COLOURS.sand), color: COLOURS.leaf }}>
          Back to Home
        </Link>
      </div>
      <Toast toast={toast} onClose={close} />
    </>
  );
}

interface SettleActions {
  add: () => void;
  keep: () => void;
  leave: () => void;
  build: () => void;
}

/** D'où part la construction : comme dans Check, la réponse adverse est donnée, le coup du joueur gardé. */
function originFor(step: PracticeStep, path: readonly string[], side: Side): BuildOrigin {
  if (step.kind === 'uncovered') {
    const start = path.slice(0, step.ply + 1);
    return { side, start, given: [start], keep: false, reply: path[step.ply + 1] };
  }
  return { side, start: path.slice(0, step.ply), given: [], played: step.played, keep: true };
}

/** Trancher l'écart comme dans l'arbre : l'ajouter, garder le répertoire, préparer une réponse, ou laisser. */
function Settle({ step, verdict, settled, actions }: { step: PracticeStep; verdict: DepartureVerdict; settled: string | null; actions: SettleActions }) {
  if (settled) {
    return (
      <p className="mt-1 flex items-baseline gap-2 text-[15px] font-bold" role="status">
        <span aria-hidden="true" style={{ color: REPERTOIRE }}>
          ✓
        </span>
        {settled}
      </p>
    );
  }
  const played = figurineMove(step.played, step.ply + 1);
  // Le moteur préfère le répertoire : le garder est mis en avant ; sinon, ajouter le coup joué.
  const worse = verdict !== null && verdict !== 'judging' && verdict !== 'blind';
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {step.kind === 'uncovered' ? (
        <span className="grid grid-cols-2 gap-1.5">
          <Action onClick={actions.build} primary>
            Prepare a reply
          </Action>
          <Action onClick={actions.leave}>Not worth it</Action>
        </span>
      ) : (
        <>
          <span className="grid grid-cols-2 gap-1.5">
            <Action onClick={actions.add} primary={!worse}>
              Add {played}
            </Action>
            {step.kind === 'left' ? (
              <Action onClick={actions.keep} primary={worse}>
                Keep {step.planned.length === 1 ? figurineMove(step.planned[0], step.ply + 1) : 'mine'}
              </Action>
            ) : (
              <Action onClick={actions.leave}>Not worth it</Action>
            )}
          </span>
          <button type="button" onClick={actions.build} className="self-start rounded-lg py-1.5 text-[13px] font-semibold underline-offset-4 hover:underline focus-visible:outline-2" style={{ color: COLOURS.leafSoft }}>
            Add it and prepare what follows →
          </button>
        </>
      )}
    </div>
  );
}

function Action({ onClick, primary = false, children }: { onClick: () => void; primary?: boolean; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      transition={SPRING}
      className="w-full rounded-xl px-3 py-2.5 text-[15px] font-bold leading-tight focus-visible:outline-2 focus-visible:outline-offset-2"
      style={primary ? raised(true) : { ...tile(COLOURS.sand), color: COLOURS.leaf }}
    >
      {children}
    </motion.button>
  );
}

const JUDGEMENT_WORDS: Record<Judgement, [string, string]> = {
  inaccuracy: ['inaccuracy', 'inaccuracies'],
  mistake: ['mistake', 'mistakes'],
  blunder: ['blunder', 'blunders'],
};

/** Ce que le moteur pense des coups du joueur, tous, dans le répertoire comme en dehors. */
function Analysis({ side, path, from, fens, evaluations, verdicts, blind, onShow }: { side: Side; path: readonly string[]; from: number; fens: readonly string[]; evaluations: ReadonlyMap<string, Evaluation>; verdicts: ReadonlyMap<number, MoveVerdict>; blind: boolean; onShow: (plies: number) => void }) {
  const own = Array.from({ length: Math.max(path.length - from, 0) }, (_, index) => from + index).filter((ply) => (ply % 2 === 0) === (side === 'w')).length;
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
              <span className="flex items-center gap-1.5">
                {figurineMove(path[ply], ply + 1)}
                <Badge kind={verdict.judgement} />
              </span>
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
function ShownMove({ side, path, ply, badges, evaluation, verdict, blind }: { side: Side; path: readonly string[]; ply: number; badges: readonly BadgeKind[]; evaluation: Evaluation | undefined; verdict: MoveVerdict | undefined; blind: boolean }) {
  const cp = evaluation && (side === 'w' ? evaluation.cp : -evaluation.cp);
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-[15px]">
      <span className="font-bold">{figurineMove(path[ply], ply + 1)}</span>
      {badges.map((kind) => (
        <span key={kind} className="flex items-center gap-1 text-[14px] font-semibold" style={{ color: kind === 'correct' ? COLOURS.leafSoft : BADGES[kind].colour }}>
          <Badge kind={kind} />
          {BADGES[kind].label}
        </span>
      ))}
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

function MoveList({ path, shown, badgesOf, onShow }: { path: readonly string[]; shown: number; badgesOf: (ply: number) => BadgeKind[]; onShow: (plies: number) => void }) {
  const rows = Array.from({ length: Math.ceil(path.length / 2) }, (_, index) => index);
  const cell = (ply: number) => {
    if (ply >= path.length) return <span />;
    const badges = badgesOf(ply);
    return (
      <button
        type="button"
        aria-current={shown === ply + 1 ? 'step' : undefined}
        onClick={() => onShow(ply + 1)}
        className="flex min-h-10 items-center gap-1.5 rounded-xl px-2.5 text-left text-[15px] focus-visible:outline-2"
        style={shown === ply + 1 ? { background: COLOURS.sand, fontWeight: 700 } : undefined}
      >
        <span>{figurine(path[ply])}</span>
        {badges.map((kind) => (
          <Badge key={kind} kind={kind} />
        ))}
      </button>
    );
  };
  const counts = new Map<BadgeKind, number>();
  for (let ply = 0; ply < path.length; ply++) for (const kind of badgesOf(ply)) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  return (
    <div className="flex flex-col rounded-2xl px-2 py-1.5" style={tile(COLOURS.paper)}>
      <ol className="grid grid-cols-[2.25rem_1fr_1fr] items-center">
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
      {counts.size > 0 && (
        <ul aria-label="Legend" className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1.5 border-t px-1 pt-2.5 pb-1 text-[13px]" style={{ borderColor: COLOURS.sand, color: COLOURS.leafSoft }}>
          {BADGE_ORDER.filter((kind) => counts.has(kind)).map((kind) => (
            <li key={kind} className="flex items-center gap-1">
              <Badge kind={kind} />
              {BADGES[kind].label}
              <span className="font-bold tabular-nums" style={{ color: COLOURS.leaf }}>
                {counts.get(kind)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
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
