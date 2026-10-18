// PROTOTYPE — variante C : la ligne racontée en quelques moments (le décrochage, les embranchements),
// chacun avec son plateau, et les parties du joueur sur la ligne en regard.
import { figurineMove } from '../domain/notation';
import { formatPercent } from '../flame/format';
import type { LineSlotProps } from '../OpeningsPage';
import { COLOURS, raised, tile } from '../workshop/theme';
import { ArrowBoard, LineHeader, ResultDot } from './parts';
import { arrowMoves, formatDate, INK } from './ui';
import { toneOf, useLineStudy, type LineGame, type LineStudy, type Position } from './study';

const MAX_MOVES = 5;

export function MomentsLine({ tree, path, onBack, onOpen }: LineSlotProps) {
  const study = useLineStudy(tree, path);
  const moments = momentsOf(study);

  return (
    <section aria-label="Line" className="flex flex-col gap-6">
      <LineHeader study={study} path={path} side={tree.side} onBack={onBack} />
      <LineStrip study={study} anchors={new Set(moments.map((moment) => moment.position.ply))} />
      <div className="grid grid-cols-[1fr_minmax(0,22rem)] items-start gap-10">
        <ol className="flex flex-col gap-6">
          {moments.map((moment) => (
            <li key={moment.position.ply} id={`moment-${moment.position.ply}`}>
              <MomentCard study={study} moment={moment} flipped={tree.side === 'b'} onOpen={(san) => onOpen([...moment.position.path, san])} />
            </li>
          ))}
        </ol>
        <Games study={study} />
      </div>
    </section>
  );
}

interface Moment {
  position: Position;
  isDrop: boolean;
}

// Un moment = une position où la ligne aurait pu partir ailleurs, ou celle où le score décroche.
function momentsOf(study: LineStudy): Moment[] {
  const { positions, drop, steps, average } = study;
  const dropPosition = drop === null ? null : steps[drop - 1].byPlayer ? drop - 1 : drop;
  return positions
    .filter((position) => {
      if (position.ply === dropPosition) return true;
      if (position.moves.length < 2 || !position.next) return false;
      return position.moves.some((move) => toneOf(move.rate, move.games, average) !== 'even');
    })
    .map((position) => ({ position, isDrop: position.ply === dropPosition }))
    .sort((a, b) => Number(b.isDrop) - Number(a.isDrop));
}

function LineStrip({ study, anchors }: { study: LineStudy; anchors: ReadonlySet<number> }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {study.steps.map((step) => {
        const tone = toneOf(step.rate, step.games, study.average);
        return (
          <li key={step.ply} className={step.ply > study.entry ? 'opacity-60' : ''}>
            <a
              href={anchors.has(step.ply - 1) ? `#moment-${step.ply - 1}` : undefined}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px]"
              style={anchors.has(step.ply - 1) ? { ...tile(COLOURS.paper), outline: `2px solid ${COLOURS.sand}` } : tile(COLOURS.paper)}
            >
              <span className={step.byPlayer ? 'font-extrabold' : 'font-medium'}>{figurineMove(step.san, step.ply)}</span>
              <span className="size-2 rounded-full" style={{ background: INK[tone] }} />
              <span className="text-[11px] font-semibold tabular-nums opacity-70">{formatPercent(step.rate)}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

function MomentCard({ study, moment, flipped, onOpen }: { study: LineStudy; moment: Moment; flipped: boolean; onOpen: (san: string) => void }) {
  const { position, isDrop } = moment;
  const previous = study.positions[position.ply - 1];
  const reached = study.steps[position.ply - 1];
  const listed = position.moves.filter((move, index) => index < MAX_MOVES || move.onLine);
  return (
    <article
      className="grid grid-cols-[15rem_1fr] gap-6 rounded-3xl p-5"
      style={{
        background: COLOURS.paper,
        boxShadow: isDrop ? `0 0 0 3px ${COLOURS.terracotta}, 0 14px 30px -14px oklch(0.4 0.1 35 / 0.5)` : '0 2px 10px -4px oklch(0.35 0.06 60 / 0.25)',
      }}
    >
      <ArrowBoard
        path={position.path}
        flipped={flipped}
        arrows={arrowMoves(position.moves).map((move) => ({
          san: move.san,
          tone: toneOf(move.rate, move.games, study.average),
          share: move.share,
          emphasis: move.onLine,
        }))}
      />
      <div className="flex min-w-0 flex-col gap-3">
        <header className="flex flex-col gap-1">
          <span className="text-[12px] font-bold tracking-wide uppercase" style={{ color: isDrop ? COLOURS.terracotta : COLOURS.leafSoft }}>
            {isDrop ? 'Where it goes wrong' : position.playerToMove ? 'Your choice' : 'Their choice'}
          </span>
          <h3 className="text-[20px] font-extrabold tracking-[-0.02em]">{reached ? `After ${figurineMove(reached.san, reached.ply)}` : 'Start'}</h3>
          {isDrop && previous && (
            <span className="text-[14px] font-semibold">
              {formatPercent(previous.rate)} → <span style={{ color: COLOURS.terracotta }}>{formatPercent(position.rate)}</span>
              <span style={{ color: COLOURS.leafSoft }}> · {position.games} games</span>
            </span>
          )}
        </header>
        <ul className="flex flex-col gap-1.5">
          {listed.map((move) => {
            const tone = toneOf(move.rate, move.games, study.average);
            return (
              <li key={move.san}>
                <button
                  type="button"
                  disabled={move.onLine}
                  onClick={() => onOpen(move.san)}
                  className="grid w-full grid-cols-[5.5rem_1fr_2.5rem_3.5rem] items-center gap-3 rounded-xl px-3 py-1.5 text-left text-[13px] enabled:hover:-translate-y-0.5"
                  style={raised(move.onLine)}
                >
                  <span className="text-[15px] font-extrabold">{figurineMove(move.san, position.ply + 1)}</span>
                  <span className="text-[11px] font-semibold opacity-70">{move.onLine ? 'this line' : `${formatPercent(move.share)} of games`}</span>
                  <span className="text-right tabular-nums opacity-75">{move.games}</span>
                  <span className="flex items-center justify-end gap-1.5 font-extrabold tabular-nums">
                    <span className="size-2.5 rounded-full" style={{ background: INK[tone] }} />
                    {formatPercent(move.rate)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {position.moves.length + position.hidden > listed.length && (
          <p className="text-[12px]" style={{ color: COLOURS.leafSoft }}>
            +{position.moves.length + position.hidden - listed.length} other moves
          </p>
        )}
      </div>
    </article>
  );
}

function Games({ study }: { study: LineStudy }) {
  const { games, steps } = study;
  const count = (score: number) => games.filter(({ game }) => game.score === score).length;
  return (
    <aside aria-label="Your games" className="sticky top-6 flex flex-col gap-3 rounded-3xl p-5" style={tile(COLOURS.sand)}>
      <h2 className="text-[18px] font-extrabold tracking-[-0.02em]">Your games here</h2>
      <p className="flex gap-3 text-[13px] font-bold">
        <span>{games.length} games</span>
        <span style={{ color: INK.winning }}>{count(1)} W</span>
        <span>{count(0.5)} ½</span>
        <span style={{ color: COLOURS.terracotta }}>{count(0)} L</span>
      </p>
      <ul className="flex max-h-[34rem] flex-col gap-1 overflow-y-auto pr-1">
        {games.map((lineGame, index) => (
          <GameRow key={index} lineGame={lineGame} length={steps.length} entry={study.entry} />
        ))}
      </ul>
    </aside>
  );
}

function GameRow({ lineGame, length, entry }: { lineGame: LineGame; length: number; entry: number }) {
  const { game, followed } = lineGame;
  const left = game.moves[followed];
  return (
    <li className="grid grid-cols-[1.5rem_3.5rem_1fr] items-center gap-2 rounded-lg px-1.5 py-1 text-[12px]" style={{ background: COLOURS.paper }}>
      <ResultDot score={game.score} />
      <span className="font-semibold tabular-nums" style={{ color: COLOURS.leafSoft }}>
        {formatDate(game.playedAt)}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="flex gap-px" aria-hidden="true">
          {Array.from({ length }, (_, ply) => (
            <span
              key={ply}
              className="h-2 w-1.5 rounded-[1px]"
              style={{ background: ply < followed ? (ply < entry ? COLOURS.leaf : COLOURS.leafSoft) : COLOURS.sand }}
            />
          ))}
        </span>
        <span className="truncate font-semibold">{left ? `then ${figurineMove(left, followed + 1)}` : 'whole line'}</span>
      </span>
    </li>
  );
}
