// PROTOTYPE — variante D : le moteur contre les résultats. Dit si la ligne se perd sur un coup à
// remplacer ou après l'ouverture, récapitule les erreurs décisives et renvoie l'analyse à Lichess.
import { useMemo, useState, type ReactNode } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { figurineMove } from '../domain/notation';
import type { PlayedGame } from '../domain/playedGame';
import { formatPercent } from '../flame/format';
import type { LineSlotProps } from '../OpeningsPage';
import { replayLine } from '../position/replay';
import { COLOURS, raised, tile } from '../workshop/theme';
import { analyseGame, diagnose, gameFens, WORTH_WORKING, type AnalysedGame, type Diagnosis, type GameTurn } from './diagnosis';
import { useEvaluations } from './engine';
import { ForkRow, type Pointed } from './ForkMapLine';
import { ArrowBoard, LineHeader, ResultDot, type BoardArrow } from './parts';
import { extendPreparation, preparedUntil, type PrepMove } from './preparation';
import fullGames from './recent-full-games.json';
import { toneOf, useLineStudy, type LineStudy } from './study';
import { arrowMoves, formatDate, lichessGame, lichessPosition, lichessPuzzles, lichessVsComputer } from './ui';

interface FullGame extends PlayedGame {
  url: string;
}

const LINE_DEPTH = 16;
const GAME_DEPTH = 12;
const GAME_PLIES = 40;
const MAX_GAMES = 20;
const MAX_REPLACEMENTS = 3;
const CHART_HEIGHT = 150;
const TOP = 0.85;

const WORTH = COLOURS.leaf;
const SCORE = COLOURS.kumquatDeep;
const BEST = 'oklch(0.50 0.12 148)';

interface Shown {
  path: readonly string[];
  arrows: BoardArrow[];
  caption: ReactNode;
  link: { href: string; label: string };
}

export function DiagnosisLine({ tree, path, onBack, onOpen }: LineSlotProps) {
  const black = tree.side === 'b';
  const study = useLineStudy(tree, path);
  const lineFens = useMemo(() => replayLine(study.steps.map((step) => step.san)).fens, [study]);
  const lineEvals = useEvaluations(lineFens, LINE_DEPTH);
  const diagnosis = useMemo(() => diagnose(study, tree.side, lineEvals, lineFens), [study, tree.side, lineEvals, lineFens]);
  const lineDone = diagnosis.evaluated === lineFens.length;
  const key = lineDone ? diagnosis.key : null;

  const keyPath = useMemo(() => study.steps.slice(0, key ?? 0).map((step) => step.san), [study, key]);
  const games = useMemo(() => {
    if (key === null) return [];
    return (fullGames as FullGame[])
      .filter((game) => game.side === tree.side && keyPath.every((san, index) => game.moves[index] === san))
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
      .slice(0, MAX_GAMES);
  }, [key, keyPath, tree.side]);
  const fensByGame = useMemo(() => games.map((game) => gameFens(game.moves, key ?? 0, GAME_PLIES)), [games, key]);
  const allGameFens = useMemo(() => fensByGame.flat(), [fensByGame]);
  const gameEvals = useEvaluations(allGameFens, GAME_DEPTH, key !== null);
  const analysed = games.map((game, index) => analyseGame(game.moves, key ?? 0, fensByGame[index], tree.side, gameEvals));

  const preparation = useMemo(
    () => (key === null ? [] : extendPreparation(games, keyPath, tree.side, gameEvals)),
    [key, games, keyPath, tree.side, gameEvals],
  );

  const [selected, setSelected] = useState<number | null>(null);
  const [pointed, setPointed] = useState<Pointed | null>(null);
  const [prepPointed, setPrepPointed] = useState<PrepPointed | null>(null);
  const keyPly = key ?? study.entry;

  const shown = ((): Shown => {
    if (pointed) {
      const position = study.positions[pointed.ply];
      const move = position.moves.find((candidate) => candidate.san === pointed.san);
      return {
        path: position.path,
        arrows: move ? [{ san: move.san, tone: toneOf(move.rate, move.games, study.average), share: 0.6, emphasis: true }] : [],
        caption: move && (
          <>
            {figurineMove(move.san, position.ply + 1)} · {move.games} games · {formatPercent(move.rate)}
          </>
        ),
        link: { href: lichessPosition(lineFens[pointed.ply] ?? lineFens[0], black), label: 'Analyse on Lichess ↗' },
      };
    }
    if (prepPointed) {
      const { path: before, move } = prepPointed;
      return {
        path: before,
        arrows: [
          { san: move.san, tone: move.replacement ? 'losing' : 'even', colour: move.replacement || !move.byPlayer ? undefined : COLOURS.leaf, share: 0.6, emphasis: true },
          ...(move.replacement ? [{ san: move.replacement.best, tone: 'winning' as const, colour: BEST, share: 0.6, emphasis: true }] : []),
        ],
        caption: <PrepCaption move={move} />,
        link: { href: lichessPosition(fenOf(before), black), label: 'Analyse on Lichess ↗' },
      };
    }
    const turn = selected === null ? null : analysed[selected].turn;
    if (selected !== null && turn) {
      const game = games[selected];
      return {
        path: game.moves.slice(0, turn.ply - 1),
        arrows: [
          { san: turn.san, tone: 'losing', share: 0.6, emphasis: true },
          ...(turn.best && turn.best !== turn.san ? [{ san: turn.best, tone: 'winning' as const, colour: BEST, share: 0.6, emphasis: true }] : []),
        ],
        caption: <TurnLabel turn={turn} />,
        link: { href: lichessGame(game.moves, turn.ply - 1, black), label: 'Open this game on Lichess ↗' },
      };
    }
    const position = study.positions[keyPly];
    const point = diagnosis.points[keyPly];
    return {
      path: position.path,
      arrows: arrowMoves(position.moves).map((move) => ({
        san: move.san,
        tone: toneOf(move.rate, move.games, study.average),
        share: move.share,
        emphasis: move.onLine,
      })),
      caption: point.worth !== null && (
        <>
          worth <span style={{ color: WORTH }}>{formatPercent(point.worth)}</span> · you score{' '}
          <span style={{ color: SCORE }}>{formatPercent(point.score)}</span> · {point.games} games
        </>
      ),
      link: { href: lichessPosition(lineFens[keyPly], black), label: 'Study this position on Lichess ↗' },
    };
  })();

  return (
    <section aria-label="Line" className="flex flex-col gap-8">
      <LineHeader study={study} path={path} side={tree.side} onBack={onBack} />
      <div className="grid grid-cols-[minmax(0,26rem)_1fr] items-start gap-10">
        <div className="sticky top-6 flex flex-col gap-3">
          <ArrowBoard path={shown.path} flipped={black} arrows={shown.arrows} />
          <p className="min-h-5 px-1 text-[14px] font-semibold">{shown.caption}</p>
          <a
            href={shown.link.href}
            target="_blank"
            rel="noreferrer"
            className="self-start rounded-full px-4 py-2 text-[15px] font-bold"
            style={{ background: COLOURS.leaf, color: COLOURS.cream, boxShadow: '0 6px 14px -6px oklch(0.3 0.06 150 / 0.55)' }}
          >
            {shown.link.label}
          </a>
        </div>
        <div className="flex min-w-0 flex-col gap-8">
          <Verdict study={study} diagnosis={diagnosis} total={lineFens.length} keyPly={key} />
          {key !== null && (
            <section aria-label="Your plan" className="flex flex-col gap-5">
              <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Your plan for this line</h2>
              <Step number={1} title="Extend your preparation">
                <Preparation moves={preparation} keyPath={keyPath} pending={analysed.some(({ chances }) => chances.includes(null))} onPoint={setPrepPointed} />
              </Step>
              <Step number={2} title="Practise the position">
                <Practice fens={lineFens.slice(0, key + 1)} />
                <Fold title={`Your decisive mistakes from here · ${analysed.filter(({ turn }) => turn).length}`}>
                  <Mistakes games={games} analysed={analysed} black={black} keyPly={key} selected={selected} onSelect={setSelected} />
                </Fold>
              </Step>
              <Step number={3} title="Track your score">
                <Progress study={study} goal={diagnosis.points[study.entry].worth} />
              </Step>
            </section>
          )}
          <Fold title="Engine vs you, move by move">
            <EngineVsYou study={study} diagnosis={diagnosis} keyPly={key} />
          </Fold>
          <Fold title="The whole line">
            <WholeLine study={study} pointed={pointed} onPoint={setPointed} onOpen={onOpen} />
          </Fold>
        </div>
      </div>
    </section>
  );
}

interface PrepPointed {
  path: readonly string[];
  move: PrepMove;
}

function fenOf(path: readonly string[]) {
  return replayLine(path).fens[path.length];
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <article className="flex flex-col gap-3 rounded-3xl p-5" style={{ background: COLOURS.paper, boxShadow: '0 2px 10px -4px oklch(0.35 0.06 60 / 0.25)' }}>
      <header className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full text-[16px] font-extrabold" style={{ background: COLOURS.leaf, color: COLOURS.cream }}>
          {number}
        </span>
        <h3 className="text-[19px] font-extrabold tracking-[-0.02em]">{title}</h3>
      </header>
      {children}
    </article>
  );
}

function Preparation({ moves, keyPath, pending, onPoint }: { moves: PrepMove[]; keyPath: readonly string[]; pending: boolean; onPoint: (pointed: PrepPointed | null) => void }) {
  if (pending) {
    return (
      <p className="text-[14px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        Engine on your games…
      </p>
    );
  }
  const until = preparedUntil(moves);
  const fixes = countFixes(moves);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        {fixes > 0 ? `${fixes} habit${fixes > 1 ? 's' : ''} to fix` : 'Your habits hold up'}
        {until > 0 && ` · your games stop overlapping after move ${Math.ceil(until / 2)}`}
      </p>
      {moves.length > 0 && (
        <ul className="flex flex-col gap-1.5" onMouseLeave={() => onPoint(null)}>
          {moves.map((move) => (
            <PrepBranch key={move.san} move={move} path={keyPath} onPoint={onPoint} />
          ))}
        </ul>
      )}
      <button
        type="button"
        disabled
        title="Comes with Verify: your preparation, replayed on your phone"
        className="self-start rounded-full px-4 py-1.5 text-[14px] font-bold opacity-50"
        style={tile(COLOURS.sand)}
      >
        Add to my preparation
      </button>
    </div>
  );
}

function countFixes(moves: readonly PrepMove[]): number {
  return moves.reduce((sum, move) => sum + (move.replacement ? 1 : 0) + countFixes(move.next), 0);
}

// Un coup adverse et la réponse du joueur tiennent sur une rangée ; les autres réponses adverses s'indentent dessous.
function PrepBranch({ move, path, onPoint }: { move: PrepMove; path: readonly string[]; onPoint: (pointed: PrepPointed | null) => void }) {
  const chain = [{ move, path }];
  let last = move;
  let after = [...path, move.san];
  while (last.next.length === 1 && last.next[0].byPlayer) {
    chain.push({ move: last.next[0], path: after });
    after = [...after, last.next[0].san];
    last = last.next[0];
  }
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {chain.map((link) => (
          <PrepChip key={link.move.ply} move={link.move} onPoint={() => onPoint({ path: link.path, move: link.move })} />
        ))}
      </div>
      {last.next.length > 0 && (
        <ul className="ml-3 flex flex-col gap-1.5 border-l-2 pl-3" style={{ borderColor: COLOURS.sand }}>
          {last.next.map((next) => (
            <PrepBranch key={next.san} move={next} path={after} onPoint={onPoint} />
          ))}
        </ul>
      )}
    </li>
  );
}

function PrepChip({ move, onPoint }: { move: PrepMove; onPoint: () => void }) {
  if (!move.byPlayer) {
    return (
      <span onMouseEnter={onPoint} className="rounded-lg px-2 py-0.5 text-[13px] font-semibold" style={{ background: COLOURS.opponent }}>
        {figurineMove(move.san, move.ply)} <span className="text-[11px] opacity-60">{move.games}</span>
      </span>
    );
  }
  if (!move.replacement) {
    return (
      <span onMouseEnter={onPoint} className="rounded-lg px-2 py-0.5 text-[14px] font-extrabold" style={tile('oklch(0.88 0.045 145)')}>
        {figurineMove(move.san, move.ply)} ✓
      </span>
    );
  }
  return (
    <span onMouseEnter={onPoint} className="flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[14px]" style={tile(COLOURS.apricot)}>
      <span className="font-semibold line-through opacity-70">{figurineMove(move.san, move.ply)}</span>→
      <span className="font-extrabold" style={{ color: COLOURS.leaf }}>
        {figurineMove(move.replacement.best, move.ply)}
      </span>
      <span className="text-[11px] font-bold opacity-70">−{Math.round(move.replacement.loss * 100)}</span>
    </span>
  );
}

function PrepCaption({ move }: { move: PrepMove }) {
  if (!move.byPlayer) return <>{figurineMove(move.san, move.ply)} · {move.games} of your games</>;
  if (!move.replacement) return <>{figurineMove(move.san, move.ply)} · your habit, the engine agrees</>;
  return (
    <>
      <span style={{ color: COLOURS.terracotta }}>{figurineMove(move.san, move.ply)}</span> costs {Math.round(move.replacement.loss * 100)} pts ·
      engine: <span style={{ color: BEST }}>{figurineMove(move.replacement.best, move.ply)}</span>
    </>
  );
}

function Practice({ fens }: { fens: string[] }) {
  const opening = useOpeningName(fens);
  const fen = fens[fens.length - 1];
  return (
    <div className="flex flex-wrap gap-2">
      <ExternalButton href={lichessVsComputer(fen)} label="Play it against Stockfish ↗" />
      {opening && <ExternalButton href={lichessPuzzles(opening.name)} label={`Puzzles: ${opening.name.split(':')[0]} ↗`} />}
    </div>
  );
}

function ExternalButton({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="rounded-full px-4 py-1.5 text-[14px] font-bold" style={tile(COLOURS.sand)}>
      {label}
    </a>
  );
}

const MONTHS = 12;

// Score mois par mois sur la ligne, face à ce qu'elle vaut : le progrès se lit à la barre qui rejoint l'objectif.
function Progress({ study, goal }: { study: LineStudy; goal: number | null }) {
  const now = new Date();
  const months = Array.from({ length: MONTHS }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1 - index), 1));
    const prefix = date.toISOString().slice(0, 7);
    const played = study.games.filter(({ game }) => game.playedAt.startsWith(prefix));
    return {
      prefix,
      label: date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
      games: played.length,
      score: played.length ? played.reduce((sum, { game }) => sum + game.score, 0) / played.length : null,
    };
  });
  const entry = study.steps[study.entry - 1];
  const height = 90;
  const y = (rate: number) => (1 - rate) * height;

  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap gap-x-4 text-[14px] font-semibold">
        <span>
          now <span style={{ color: SCORE }}>{entry ? formatPercent(entry.rate) : '—'}</span>
          <span style={{ color: COLOURS.leafSoft }}> · {entry?.games ?? 0} games</span>
        </span>
        {goal !== null && (
          <span>
            goal <span style={{ color: WORTH }}>{formatPercent(goal)}</span>
            <span style={{ color: COLOURS.leafSoft }}> · what the position is worth</span>
          </span>
        )}
      </p>
      <div className="relative" style={{ height }}>
        {goal !== null && <span className="absolute inset-x-0 border-t-2 border-dashed" style={{ top: y(goal), borderColor: WORTH }} />}
        <div className="absolute inset-0 flex items-end gap-1.5">
          {months.map((month) => (
            <span key={month.prefix} className="relative flex h-full flex-1 items-end justify-center">
              {month.score !== null && (
                <span
                  className="w-full max-w-7 rounded-t-md"
                  style={{ height: Math.max(3, height - y(month.score)), background: goal !== null && month.score >= goal ? COLOURS.sage : SCORE, opacity: 0.35 + 0.65 * Math.min(1, month.games / 6) }}
                  title={`${month.games} games · ${formatPercent(month.score)}`}
                />
              )}
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-1.5">
        {months.map((month) => (
          <span key={month.prefix} className="flex flex-1 flex-col items-center text-[10px] leading-tight" style={{ color: COLOURS.leafSoft }}>
            <span className="font-semibold">{month.label}</span>
            <span className="tabular-nums">{month.games || '·'}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Verdict({ study, diagnosis, total, keyPly }: { study: LineStudy; diagnosis: Diagnosis; total: number; keyPly: number | null }) {
  if (diagnosis.openingCost === null || diagnosis.playCost === null || diagnosis.evaluated < total) {
    return (
      <article className="rounded-3xl p-6 text-[15px] font-semibold" style={{ ...tile(COLOURS.sand), color: COLOURS.leafSoft }}>
        Engine at work… {diagnosis.evaluated}/{total} positions
      </article>
    );
  }
  const movesCost = diagnosis.openingCost >= WORTH_WORKING;
  const playCost = diagnosis.playCost >= WORTH_WORKING;
  const keyStep = keyPly === null ? undefined : study.steps[keyPly - 1];
  const title = movesCost && playCost
    ? 'A move to replace, and what follows to work on'
    : movesCost
      ? 'One of your moves costs you'
      : playCost
        ? 'Your opening is fine. What follows isn’t.'
        : 'No clear cause: the gap may be noise';

  return (
    <article className="flex flex-col gap-4 rounded-3xl p-6" style={tile(COLOURS.sand)}>
      <h2 className="text-[26px] leading-tight font-extrabold tracking-[-0.03em]">{title}</h2>
      <div className="flex flex-wrap gap-2">
        <Cost label="your opening moves" cost={diagnosis.openingCost} />
        <Cost label="after the opening" cost={diagnosis.playCost} />
      </div>
      {movesCost && (
        <ul className="flex flex-col gap-1.5">
          {diagnosis.losses.slice(0, MAX_REPLACEMENTS).map((loss) => (
            <li key={loss.ply} className="flex flex-wrap items-baseline gap-x-2 rounded-xl px-3 py-2 text-[15px]" style={{ background: COLOURS.paper }}>
              <span className="font-extrabold" style={{ color: COLOURS.terracotta }}>
                {figurineMove(loss.san, loss.ply)}
              </span>
              <span className="font-semibold">costs</span>
              <span className="font-extrabold">{Math.round(loss.loss * 100)} pts</span>
              {loss.best && (
                <span className="ml-auto text-[14px] font-semibold" style={{ color: COLOURS.leafSoft }}>
                  engine: <span className="font-extrabold" style={{ color: BEST }}>{figurineMove(loss.best, loss.ply)}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {playCost && (
        <p className="text-[15px] font-semibold">
          The position to work on: {keyStep ? <>after <b>{figurineMove(keyStep.san, keyStep.ply)}</b></> : 'this line'}. Follow the plan below.
        </p>
      )}
    </article>
  );
}

function Cost({ label, cost }: { label: string; cost: number }) {
  const lost = cost >= WORTH_WORKING;
  return (
    <span className="flex items-baseline gap-2 rounded-xl px-3 py-1.5" style={{ background: COLOURS.paper }}>
      <span className="text-[20px] font-extrabold tabular-nums" style={{ color: lost ? COLOURS.terracotta : COLOURS.leafSoft }}>
        {cost > 0.005 ? '−' : '+'}
        {Math.abs(Math.round(cost * 100))} pts
      </span>
      <span className="text-[13px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        {label}
      </span>
    </span>
  );
}

interface MistakesProps {
  games: FullGame[];
  analysed: AnalysedGame[];
  black: boolean;
  keyPly: number;
  selected: number | null;
  onSelect: (index: number | null) => void;
}

function Mistakes({ games, analysed, black, keyPly, selected, onSelect }: MistakesProps) {
  const pending = analysed.filter(({ chances }) => chances.some((chance) => chance === null)).length;
  const order = games
    .map((_, index) => index)
    .sort((a, b) => (analysed[a].turn?.ply ?? Infinity) - (analysed[b].turn?.ply ?? Infinity));
  const turns = analysed.flatMap(({ turn }) => (turn ? [Math.ceil(turn.ply / 2)] : []));

  return (
    <section aria-label="Your decisive mistakes" className="flex flex-col gap-3">
      <header className="flex items-baseline gap-3">
        <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Your decisive mistakes</h2>
        <span className="text-[13px] font-semibold" style={{ color: COLOURS.leafSoft }}>
          {pending > 0
            ? `engine on ${pending} of ${games.length} games…`
            : turns.length > 0 && `${turns.length} of ${games.length} games · moves ${Math.min(...turns)}–${Math.max(...turns)}`}
        </span>
      </header>
      <ul className="flex flex-col gap-1.5">
        {order.map((index) => {
          const game = games[index];
          const { chances, turn } = analysed[index];
          const isSelected = selected === index;
          return (
            <li key={game.url}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => turn && onSelect(isSelected ? null : index)}
                onKeyDown={(event) => event.key === 'Enter' && turn && onSelect(isSelected ? null : index)}
                className={`grid w-full grid-cols-[1.5rem_3.5rem_11rem_1fr_auto] items-center gap-3 rounded-xl px-3 py-2 text-left text-[14px] ${turn ? 'cursor-pointer' : ''}`}
                style={raised(isSelected)}
              >
                <ResultDot score={game.score} />
                <span className="text-[12px] font-semibold tabular-nums opacity-75">{formatDate(game.playedAt)}</span>
                <Sparkline chances={chances} turnIndex={turn ? turn.ply - 1 - keyPly : null} />
                <span className="truncate">
                  {turn ? (
                    <TurnLabel turn={turn} inverted={isSelected} />
                  ) : chances.some((chance) => chance === null) ? (
                    <span className="opacity-50">…</span>
                  ) : (
                    <span className="opacity-60">no decisive mistake in the next {GAME_PLIES / 2} moves</span>
                  )}
                </span>
                <a
                  href={lichessGame(game.moves, turn ? turn.ply - 1 : 0, black)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="rounded-full px-2.5 py-0.5 text-[12px] font-bold"
                  style={isSelected ? { background: COLOURS.cream, color: COLOURS.leaf } : tile(COLOURS.sand)}
                >
                  Lichess ↗
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Chances du joueur coup après coup depuis la position clé ; le trait du milieu marque 50 %.
function Sparkline({ chances, turnIndex }: { chances: (number | null)[]; turnIndex: number | null }) {
  const width = 176;
  const height = 26;
  const x = (index: number) => (index / GAME_PLIES) * width;
  const y = (chance: number) => (1 - chance) * height;
  const points = chances.flatMap((chance, index) => (chance === null ? [] : [`${x(index)},${y(chance)}`]));
  const after = turnIndex === null ? null : chances[turnIndex + 1];
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke={COLOURS.sand} strokeWidth="1" />
      <polyline points={points.join(' ')} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      {turnIndex !== null && after != null && (
        <circle cx={x(turnIndex + 1)} cy={y(after)} r="3.2" fill={COLOURS.terracotta} stroke="white" strokeWidth="1" />
      )}
    </svg>
  );
}

function TurnLabel({ turn, inverted = false }: { turn: GameTurn; inverted?: boolean }) {
  return (
    <span className="font-semibold">
      <span className="font-extrabold" style={{ color: inverted ? COLOURS.apricot : COLOURS.terracotta }}>
        {figurineMove(turn.san, turn.ply)}
      </span>
      {turn.best && turn.best !== turn.san && (
        <>
          {' '}
          → <span className="font-extrabold" style={{ color: inverted ? COLOURS.sage : BEST }}>{figurineMove(turn.best, turn.ply)}</span>
        </>
      )}
      <span className="opacity-70"> · −{Math.round(turn.drop * 100)} pts</span>
    </span>
  );
}

function Fold({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="flex flex-col gap-3">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-2 self-start text-[16px] font-extrabold">
        <span className="inline-block w-4 transition-transform" style={{ transform: open ? 'rotate(90deg)' : undefined }}>
          ▸
        </span>
        {title}
      </button>
      {open && children}
    </section>
  );
}

function WholeLine({ study, pointed, onPoint, onOpen }: { study: LineStudy; pointed: Pointed | null; onPoint: (pointed: Pointed | null) => void; onOpen: (path: readonly string[]) => void }) {
  const [opponents, setOpponents] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 self-start text-[13px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        <input type="checkbox" checked={opponents} onChange={(event) => setOpponents(event.target.checked)} />
        show every opponent move
      </label>
      <ol className="flex flex-col" onMouseLeave={() => onPoint(null)}>
        {study.positions.map((position) => (
          <ForkRow
            key={position.ply}
            study={study}
            position={position}
            pointed={pointed}
            onPoint={onPoint}
            onOpen={(san) => onOpen([...position.path, san])}
            foldOpponents={!opponents}
          />
        ))}
      </ol>
    </div>
  );
}

function EngineVsYou({ study, diagnosis, keyPly }: { study: LineStudy; diagnosis: Diagnosis; keyPly: number | null }) {
  const { points } = diagnosis;
  const columns = points.length;
  const x = (index: number) => ((index + 0.5) / columns) * 100;
  const y = (rate: number) => (1 - Math.min(Math.max(rate, 0), TOP) / TOP) * CHART_HEIGHT;
  const known = points.filter((point) => point.worth !== null);
  const worthLine = known.map((point) => `${x(point.ply)},${y(point.worth!)}`).join(' ');
  const scoreLine = points.map((point) => `${x(point.ply)},${y(point.score)}`).join(' ');
  const gap = known.length > 1 ? `${worthLine} ${[...known].reverse().map((point) => `${x(point.ply)},${y(point.score)}`).join(' ')}` : '';

  return (
    <div className="rounded-3xl px-4 pt-4 pb-3" style={{ background: COLOURS.paper, boxShadow: '0 2px 10px -4px oklch(0.35 0.06 60 / 0.25)' }}>
      <div className="mb-3 flex items-center gap-5 text-[12px] font-bold">
        <Legend colour={WORTH} dashed label="what the position is worth for you (engine)" />
        <Legend colour={SCORE} label="what you score" />
      </div>
      <div className="relative" style={{ height: CHART_HEIGHT }}>
        <svg viewBox={`0 0 100 ${CHART_HEIGHT}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          {gap && <polygon points={gap} fill="oklch(0.60 0.155 35 / 0.14)" />}
          <line x1="0" x2="100" y1={y(study.average)} y2={y(study.average)} stroke={COLOURS.sand} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <polyline points={scoreLine} fill="none" stroke={SCORE} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {known.length > 1 && (
            <polyline points={worthLine} fill="none" stroke={WORTH} strokeWidth="2.5" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          )}
        </svg>
        <span className="absolute right-1 text-[11px] font-semibold" style={{ top: y(study.average) + 2, color: COLOURS.leafSoft }}>
          your avg {formatPercent(study.average)}
        </span>
        {points.map((point) => (
          <span key={point.ply}>
            <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${x(point.ply)}%`, top: y(point.score), background: SCORE }} />
            {point.ply === keyPly && (
              <span
                className="absolute -translate-x-1/2 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap"
                style={{ left: `${x(point.ply)}%`, top: Math.min(CHART_HEIGHT - 20, y(point.score) + 10), background: COLOURS.terracotta, color: 'white' }}
              >
                key position
              </span>
            )}
          </span>
        ))}
      </div>
      <ol className="mt-2 grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {points.map((point) => {
          const step = study.steps[point.ply - 1];
          return (
            <li key={point.ply} className={`flex flex-col items-center ${point.ply > study.entry ? 'opacity-60' : ''}`}>
              <span className={`text-[13px] ${!step || step.byPlayer ? 'font-extrabold' : 'font-medium'}`}>{step ? figurineMove(step.san, step.ply) : 'Start'}</span>
              <span className="text-[11px] tabular-nums" style={{ color: COLOURS.leafSoft }}>
                {point.cp === null ? '·' : formatPawns(point.cp)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Legend({ colour, label, dashed }: { colour: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="w-6" style={{ borderTop: `3px ${dashed ? 'dashed' : 'solid'} ${colour}` }} />
      {label}
    </span>
  );
}

function formatPawns(cp: number) {
  const pawns = cp / 100;
  if (Math.abs(pawns) >= 20) return pawns > 0 ? '+M' : '−M';
  return `${pawns >= 0 ? '+' : '−'}${Math.abs(pawns).toFixed(1)}`;
}
