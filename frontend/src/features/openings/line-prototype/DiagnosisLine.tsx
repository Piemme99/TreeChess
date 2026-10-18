// PROTOTYPE — variante D : le moteur contre les résultats. Sépare ce que coûtent les coups d'ouverture
// de ce qui se perd ensuite, puis montre où basculent les parties depuis la position clé.
import { useMemo, useState } from 'react';
import { figurineMove } from '../domain/notation';
import type { PlayedGame } from '../domain/playedGame';
import { formatPercent } from '../flame/format';
import type { LineSlotProps } from '../OpeningsPage';
import { replayLine } from '../position/replay';
import { COLOURS, raised, tile } from '../workshop/theme';
import { analyseGame, diagnose, gameFens, OPENING_LOSS, type AnalysedGame, type Diagnosis } from './diagnosis';
import { useEvaluations } from './engine';
import { ArrowBoard, LineHeader, ResultDot } from './parts';
import fullGames from './recent-full-games.json';
import { toneOf, useLineStudy, type LineStudy } from './study';
import { arrowMoves, formatDate } from './ui';

interface FullGame extends PlayedGame {
  url: string;
}

const LINE_DEPTH = 16;
const GAME_DEPTH = 12;
const GAME_PLIES = 40;
const MAX_GAMES = 20;
const CHART_HEIGHT = 170;
const TOP = 0.85;

const WORTH = COLOURS.leaf;
const SCORE = COLOURS.kumquatDeep;
const BEST = 'oklch(0.50 0.12 148)';

export function DiagnosisLine({ tree, path, onBack }: LineSlotProps) {
  const study = useLineStudy(tree, path);
  const lineFens = useMemo(() => replayLine(study.steps.map((step) => step.san)).fens, [study]);
  const lineEvals = useEvaluations(lineFens, LINE_DEPTH);
  const diagnosis = useMemo(() => diagnose(study, tree.side, lineEvals, lineFens), [study, tree.side, lineEvals, lineFens]);
  const lineDone = diagnosis.evaluated === lineFens.length;
  const key = lineDone ? diagnosis.key : null;

  const games = useMemo(() => {
    if (key === null) return [];
    const keyPath = study.steps.slice(0, key).map((step) => step.san);
    return (fullGames as FullGame[])
      .filter((game) => game.side === tree.side && keyPath.every((san, index) => game.moves[index] === san))
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt))
      .slice(0, MAX_GAMES);
  }, [key, study, tree.side]);
  const fensByGame = useMemo(() => games.map((game) => gameFens(game.moves, key ?? 0, GAME_PLIES)), [games, key]);
  const allGameFens = useMemo(() => fensByGame.flat(), [fensByGame]);
  const gameEvals = useEvaluations(allGameFens, GAME_DEPTH, key !== null);
  const analysed = games.map((game, index) => analyseGame(game.moves, key ?? 0, fensByGame[index], tree.side, gameEvals));

  return (
    <section aria-label="Line" className="flex flex-col gap-8">
      <LineHeader study={study} path={path} side={tree.side} onBack={onBack} />
      <EngineVsYou study={study} diagnosis={diagnosis} total={lineFens.length} keyPly={key} />
      <Split study={study} diagnosis={diagnosis} />
      {key !== null && (
        <FromHere
          study={study}
          keyPly={key}
          flipped={tree.side === 'b'}
          fen={lineFens[key]}
          diagnosis={diagnosis}
          games={games}
          analysed={analysed}
        />
      )}
    </section>
  );
}

function EngineVsYou({ study, diagnosis, total, keyPly }: { study: LineStudy; diagnosis: Diagnosis; total: number; keyPly: number | null }) {
  const { points } = diagnosis;
  const columns = points.length;
  const x = (index: number) => ((index + 0.5) / columns) * 100;
  const y = (rate: number) => (1 - Math.min(Math.max(rate, 0), TOP) / TOP) * CHART_HEIGHT;
  const known = points.filter((point) => point.worth !== null);
  const worthLine = known.map((point) => `${x(point.ply)},${y(point.worth!)}`).join(' ');
  const scoreLine = points.map((point) => `${x(point.ply)},${y(point.score)}`).join(' ');
  const gap = known.length > 1 ? `${worthLine} ${[...known].reverse().map((point) => `${x(point.ply)},${y(point.score)}`).join(' ')}` : '';

  return (
    <section aria-label="Engine vs you" className="rounded-3xl px-4 pt-4 pb-3" style={{ background: COLOURS.paper, boxShadow: '0 2px 10px -4px oklch(0.35 0.06 60 / 0.25)' }}>
      <div className="mb-3 flex items-center gap-5 text-[12px] font-bold">
        <Legend colour={WORTH} dashed label="what the position is worth for you (engine)" />
        <Legend colour={SCORE} label="what you score" />
        {diagnosis.evaluated < total && (
          <span className="ml-auto font-semibold" style={{ color: COLOURS.leafSoft }}>
            engine {diagnosis.evaluated}/{total}…
          </span>
        )}
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
            <span
              className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${x(point.ply)}%`, top: y(point.score), background: SCORE }}
            />
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
        {study.entry < columns - 1 && (
          <span className="absolute top-0 bottom-0 border-l-2 border-dashed" style={{ left: `${((study.entry + 1) / columns) * 100}%`, borderColor: COLOURS.sand }} />
        )}
      </div>
      <ol className="mt-2 grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {points.map((point) => {
          const step = study.steps[point.ply - 1];
          return (
            <li key={point.ply} className={`flex flex-col items-center ${point.ply > study.entry ? 'opacity-60' : ''}`}>
              <span className={`text-[13px] ${!step || step.byPlayer ? 'font-extrabold' : 'font-medium'}`}>{step ? figurineMove(step.san, step.ply) : 'Start'}</span>
              <span className="text-[11px] tabular-nums" style={{ color: COLOURS.leafSoft }}>
                {point.cp === null ? '·' : formatPawns(point.cp)} · {point.games}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
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

function Split({ study, diagnosis }: { study: LineStudy; diagnosis: Diagnosis }) {
  const entry = diagnosis.points[study.entry];
  return (
    <section aria-label="Where the points go" className="grid grid-cols-2 gap-5">
      <article className="flex flex-col gap-3 rounded-3xl p-5" style={tile(COLOURS.sand)}>
        <SplitTitle label="Your opening moves" cost={diagnosis.openingCost} />
        {diagnosis.openingCost === null ? null : diagnosis.losses.length === 0 ? (
          <p className="text-[14px] font-semibold" style={{ color: COLOURS.leafSoft }}>
            ✓ none of your moves on this line loses more than {Math.round(OPENING_LOSS * 100)} pts
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {diagnosis.losses.map((loss) => (
              <li key={loss.ply} className="flex items-center gap-3 rounded-xl px-3 py-1.5 text-[14px]" style={{ background: COLOURS.paper }}>
                <span className="font-extrabold">{figurineMove(loss.san, loss.ply)}</span>
                <span className="font-bold" style={{ color: COLOURS.terracotta }}>
                  −{Math.round(loss.loss * 100)} pts
                </span>
                {loss.best && (
                  <span className="ml-auto font-semibold" style={{ color: BEST }}>
                    engine: {figurineMove(loss.best, loss.ply)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </article>
      <article className="flex flex-col gap-3 rounded-3xl p-5" style={tile(COLOURS.sand)}>
        <SplitTitle label="After the opening" cost={diagnosis.playCost} />
        {entry.worth !== null && (
          <p className="text-[14px] font-semibold" style={{ color: COLOURS.leafSoft }}>
            worth <span style={{ color: WORTH }}>{formatPercent(entry.worth)}</span> · you score{' '}
            <span style={{ color: SCORE }}>{formatPercent(entry.score)}</span> · {entry.games} games
          </p>
        )}
      </article>
    </section>
  );
}

function SplitTitle({ label, cost }: { label: string; cost: number | null }) {
  const lost = cost !== null && cost > 0.005;
  return (
    <header className="flex items-baseline justify-between gap-3">
      <h2 className="text-[18px] font-extrabold tracking-[-0.02em]">{label}</h2>
      <span className="text-[28px] leading-none font-extrabold tabular-nums" style={{ color: lost ? COLOURS.terracotta : COLOURS.leafSoft }}>
        {cost === null ? '…' : `${lost ? '−' : '+'}${Math.abs(Math.round(cost * 100))} pts`}
      </span>
    </header>
  );
}

interface FromHereProps {
  study: LineStudy;
  keyPly: number;
  flipped: boolean;
  fen: string;
  diagnosis: Diagnosis;
  games: FullGame[];
  analysed: AnalysedGame[];
}

function FromHere({ study, keyPly, flipped, fen, diagnosis, games, analysed }: FromHereProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const position = study.positions[keyPly];
  const point = diagnosis.points[keyPly];
  const step = study.steps[keyPly - 1];
  const game = selected === null ? null : games[selected];
  const turn = selected === null ? null : analysed[selected].turn;

  const board = game && turn
    ? {
        path: game.moves.slice(0, turn.ply - 1),
        arrows: [
          { san: turn.san, tone: 'losing' as const, share: 0.6, emphasis: true },
          ...(turn.best && turn.best !== turn.san ? [{ san: turn.best, tone: 'winning' as const, colour: BEST, share: 0.6, emphasis: true }] : []),
        ],
      }
    : {
        path: position.path,
        arrows: arrowMoves(position.moves).map((move) => ({
          san: move.san,
          tone: toneOf(move.rate, move.games, study.average),
          share: move.share,
          emphasis: move.onLine,
        })),
      };

  return (
    <section aria-label="From the key position" className="flex flex-col gap-5">
      <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">
        From {step ? figurineMove(step.san, step.ply) : 'the start'}: where your games turn
      </h2>
      <div className="grid grid-cols-[minmax(0,26rem)_1fr] items-start gap-10">
        <div className="sticky top-6 flex flex-col gap-3">
          <ArrowBoard path={board.path} flipped={flipped} arrows={board.arrows} />
          {game && turn ? (
            <div className="flex flex-col gap-1 px-1 text-[14px] font-semibold">
              <span>
                <span style={{ color: COLOURS.terracotta }}>{figurineMove(turn.san, turn.ply)} −{Math.round(turn.drop * 100)} pts</span>
                {turn.best && turn.best !== turn.san && <span style={{ color: BEST }}> · engine: {figurineMove(turn.best, turn.ply)}</span>}
              </span>
              <span className="flex gap-4">
                <a href={game.url} target="_blank" rel="noreferrer" className="underline">
                  Game on chess.com ↗
                </a>
                <button type="button" onClick={() => setSelected(null)} className="underline" style={{ color: COLOURS.leafSoft }}>
                  back to the key position
                </button>
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1 px-1 text-[14px] font-semibold">
              {point.worth !== null && (
                <span>
                  worth <span style={{ color: WORTH }}>{formatPercent(point.worth)}</span> ({formatPawns(point.cp!)}) · you{' '}
                  <span style={{ color: SCORE }}>{formatPercent(point.score)}</span> · {point.games} games
                </span>
              )}
              <a href={lichessUrl(fen, flipped)} target="_blank" rel="noreferrer" className="underline">
                Open in Lichess (engine, explorer, master games) ↗
              </a>
            </div>
          )}
        </div>
        <TurnList games={games} analysed={analysed} keyPly={keyPly} selected={selected} onSelect={setSelected} />
      </div>
    </section>
  );
}

function TurnList({ games, analysed, keyPly, selected, onSelect }: { games: FullGame[]; analysed: AnalysedGame[]; keyPly: number; selected: number | null; onSelect: (index: number) => void }) {
  const firstMove = Math.ceil((keyPly + 1) / 2);
  const lastMove = firstMove + GAME_PLIES / 2;
  const counts = new Map<number, number>();
  for (const { turn } of analysed) if (turn) counts.set(Math.ceil(turn.ply / 2), (counts.get(Math.ceil(turn.ply / 2)) ?? 0) + 1);
  const peak = Math.max(1, ...counts.values());
  const pending = analysed.filter(({ chances }) => chances.some((chance) => chance === null)).length;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[12px] font-bold" style={{ color: COLOURS.leafSoft }}>
          decisive mistake, by move number {pending > 0 && `· engine on ${pending} games…`}
        </span>
        <div className="flex h-14 items-end gap-[2px]">
          {Array.from({ length: lastMove - firstMove + 1 }, (_, index) => {
            const move = firstMove + index;
            const count = counts.get(move) ?? 0;
            return (
              <span key={move} className="flex flex-1 flex-col items-center justify-end gap-0.5">
                <span className="w-full rounded-t-[3px]" style={{ height: `${(count / peak) * 40}px`, background: COLOURS.terracotta, minHeight: count ? 4 : 0 }} />
                <span className="text-[9px] tabular-nums" style={{ color: COLOURS.leafSoft }}>
                  {move % 5 === 0 ? move : ''}
                </span>
              </span>
            );
          })}
        </div>
      </div>
      <ul className="flex flex-col gap-1.5">
        {games.map((game, index) => {
          const { chances, turn } = analysed[index];
          const done = chances.every((chance) => chance !== null);
          return (
            <li key={game.url}>
              <button
                type="button"
                onClick={() => turn && onSelect(index)}
                className="grid w-full grid-cols-[1.5rem_3.5rem_11rem_1fr] items-center gap-3 rounded-xl px-2.5 py-1.5 text-left text-[13px]"
                style={raised(selected === index)}
              >
                <ResultDot score={game.score} />
                <span className="font-semibold tabular-nums opacity-75">{formatDate(game.playedAt)}</span>
                <Sparkline chances={chances} turnIndex={turn ? turn.ply - 1 - keyPly : null} />
                <span className="truncate font-bold">
                  {turn ? (
                    <>
                      <span style={{ color: selected === index ? COLOURS.cream : COLOURS.terracotta }}>{figurineMove(turn.san, turn.ply)}</span>
                      {turn.best && turn.best !== turn.san && <span className="font-semibold opacity-75"> · {figurineMove(turn.best, turn.ply)} better</span>}
                    </>
                  ) : done ? (
                    <span className="opacity-60">no clear mistake in {GAME_PLIES / 2} moves</span>
                  ) : (
                    <span className="opacity-50">…</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Sparkline({ chances, turnIndex }: { chances: (number | null)[]; turnIndex: number | null }) {
  const width = 176;
  const height = 26;
  const x = (index: number) => (index / GAME_PLIES) * width;
  const y = (chance: number) => (1 - chance) * height;
  const known = chances.map((chance, index) => (chance === null ? null : `${x(index)},${y(chance)}`)).filter(Boolean);
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke={COLOURS.sand} strokeWidth="1" />
      <polyline points={known.join(' ')} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      {turnIndex !== null && chances[turnIndex + 1] != null && (
        <circle cx={x(turnIndex + 1)} cy={y(chances[turnIndex + 1]!)} r="3.2" fill={COLOURS.terracotta} stroke="white" strokeWidth="1" />
      )}
    </svg>
  );
}

function formatPawns(cp: number) {
  const pawns = cp / 100;
  if (Math.abs(pawns) >= 20) return pawns > 0 ? '+M' : '−M';
  return `${pawns >= 0 ? '+' : '−'}${Math.abs(pawns).toFixed(1)}`;
}

function lichessUrl(fen: string, flipped: boolean) {
  return `https://lichess.org/analysis/standard/${fen.replaceAll(' ', '_')}${flipped ? '?color=black' : ''}`;
}
