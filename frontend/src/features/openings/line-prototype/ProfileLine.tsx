// PROTOTYPE — variante A : la courbe du score le long de la ligne, puis plateau fléché de la position choisie.
import { useState } from 'react';
import { figurineMove } from '../domain/notation';
import { formatPercent } from '../flame/format';
import type { LineSlotProps } from '../OpeningsPage';
import { COLOURS, raised, tile } from '../workshop/theme';
import { ArrowBoard, LineHeader } from './parts';
import { INK, useStepKeys } from './ui';
import { toneOf, useLineStudy, type LineStudy, type Position } from './study';

const CHART_HEIGHT = 170;
// Échelle resserrée : les lignes vivent entre 0 et 80 %, un axe 0-100 écrase les écarts.
const TOP_RATE = 0.85;

export function ProfileLine({ tree, path, onBack, onOpen }: LineSlotProps) {
  const study = useLineStudy(tree, path);
  const [focus, setFocus] = useState(study.drop ?? study.entry);
  useStepKeys(focus, study.positions.length - 1, setFocus);
  const position = study.positions[focus];

  return (
    <section aria-label="Line" className="flex flex-col gap-8">
      <LineHeader study={study} path={path} side={tree.side} onBack={onBack} />
      <Profile study={study} focus={focus} onFocus={setFocus} />
      <div className="grid grid-cols-[minmax(0,28rem)_1fr] items-start gap-10">
        <ArrowBoard
          path={position.path}
          flipped={tree.side === 'b'}
          arrows={position.moves.slice(0, 6).map((move) => ({
            san: move.san,
            tone: toneOf(move.rate, move.games, study.average),
            share: move.share,
            emphasis: move.onLine,
          }))}
        />
        <Here study={study} position={position} onFollow={() => setFocus(focus + 1)} onOpen={(san) => onOpen([...position.path, san])} onFocus={setFocus} />
      </div>
    </section>
  );
}

function Profile({ study, focus, onFocus }: { study: LineStudy; focus: number; onFocus: (ply: number) => void }) {
  const { positions, average, entry, drop } = study;
  const y = (rate: number) => (1 - Math.min(rate, TOP_RATE) / TOP_RATE) * CHART_HEIGHT;
  const columns = positions.length;
  const x = (index: number) => ((index + 0.5) / columns) * 100;
  const curve = positions.map((position, index) => `${x(index)},${y(position.rate)}`).join(' ');
  const area = `${x(0)},${CHART_HEIGHT} ${curve} ${x(columns - 1)},${CHART_HEIGHT}`;
  const maxGames = positions[1]?.games ?? 1;

  return (
    <section aria-label="Score along the line" className="rounded-3xl px-4 pt-5 pb-3" style={{ background: COLOURS.paper, boxShadow: '0 2px 10px -4px oklch(0.35 0.06 60 / 0.25)' }}>
      <div className="relative" style={{ height: CHART_HEIGHT }}>
        <svg viewBox={`0 0 100 ${CHART_HEIGHT}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <polygon points={area} fill="oklch(0.88 0.045 145 / 0.45)" />
          <line x1="0" x2="100" y1={y(average)} y2={y(average)} stroke={COLOURS.leafSoft} strokeDasharray="1.2 1.2" vectorEffect="non-scaling-stroke" />
          <polyline points={curve} fill="none" stroke={COLOURS.leaf} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        <span className="absolute right-1 text-[11px] font-semibold" style={{ top: y(average) - 16, color: COLOURS.leafSoft }}>
          your avg {formatPercent(average)}
        </span>
        {positions.map((position, index) => {
          const tone = toneOf(position.rate, position.games, average);
          const size = 10 + 16 * Math.sqrt(position.games / maxGames);
          const isDrop = position.ply === drop;
          return (
            <span key={position.ply}>
              <span
                className="absolute rounded-full"
                style={{
                  left: `calc(${x(index)}% - ${size / 2}px)`,
                  top: y(position.rate) - size / 2,
                  width: size,
                  height: size,
                  background: index === 0 ? COLOURS.leaf : INK[tone],
                  border: `3px solid ${focus === index ? COLOURS.leaf : COLOURS.paper}`,
                }}
              />
              {index > 0 && (
                <span
                  className="absolute -translate-x-1/2 text-[12px] font-bold tabular-nums"
                  style={{ left: `${x(index)}%`, top: y(position.rate) - size / 2 - 20, color: isDrop ? COLOURS.terracotta : COLOURS.leaf }}
                >
                  {formatPercent(position.rate)}
                </span>
              )}
              {isDrop && (
                <span
                  className="absolute -translate-x-1/2 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap"
                  style={{ left: `${x(index)}%`, top: Math.min(CHART_HEIGHT - 22, y(position.rate) + size / 2 + 6), background: COLOURS.terracotta, color: 'white' }}
                >
                  −{Math.round((positions[index - 1].rate - position.rate) * 100)} pts here
                </span>
              )}
            </span>
          );
        })}
        {entry < columns - 1 && (
          <span className="absolute top-0 bottom-0 border-l-2 border-dashed" style={{ left: `${(entry + 1) / columns * 100}%`, borderColor: COLOURS.sand }} />
        )}
      </div>
      <ol className="mt-2 grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {positions.map((position, index) => {
          const step = study.steps[index - 1];
          return (
            <li key={position.ply}>
              <button
                type="button"
                onClick={() => onFocus(index)}
                aria-pressed={focus === index}
                className={`flex w-full flex-col items-center rounded-xl py-1.5 ${index > entry && focus !== index ? 'opacity-60' : ''}`}
                style={focus === index ? raised(true) : undefined}
              >
                <span className={`text-[14px] ${!step || step.byPlayer ? 'font-extrabold' : 'font-medium'}`}>{step ? figurineMove(step.san, step.ply) : 'Start'}</span>
                <span className="text-[11px] tabular-nums opacity-70">{position.games}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {entry < columns - 1 && (
        <p className="mt-1 text-right text-[11px] font-semibold" style={{ color: COLOURS.leafSoft }}>
          ┊ then your most played continuation
        </p>
      )}
    </section>
  );
}

interface HereProps {
  study: LineStudy;
  position: Position;
  onFollow: () => void;
  onOpen: (san: string) => void;
  onFocus: (ply: number) => void;
}

function Here({ study, position, onFollow, onOpen, onFocus }: HereProps) {
  const last = study.positions.length - 1;
  const step = study.steps[position.ply - 1];
  return (
    <section aria-label="This position" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">
          {step ? `After ${figurineMove(step.san, step.ply)}` : 'Start'}
        </h2>
        <span className="rounded-full px-2.5 py-0.5 text-[12px] font-bold" style={position.playerToMove ? { background: COLOURS.leaf, color: COLOURS.cream } : tile(COLOURS.sand)}>
          {position.playerToMove ? 'you to move' : 'opponent to move'}
        </span>
        <span className="ml-auto flex gap-1">
          <StepButton label="←" disabled={position.ply === 0} onClick={() => onFocus(position.ply - 1)} />
          <StepButton label="→" disabled={position.ply === last} onClick={() => onFocus(position.ply + 1)} />
        </span>
      </div>
      {position.moves.length === 0 ? (
        <p className="text-[14px]" style={{ color: COLOURS.leafSoft }}>
          No move played 3 times here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {position.moves.map((move) => {
            const tone = toneOf(move.rate, move.games, study.average);
            return (
              <li key={move.san}>
                <button
                  type="button"
                  onClick={() => (move.onLine ? onFollow() : onOpen(move.san))}
                  className="grid w-full grid-cols-[5.5rem_1fr_3rem_3.5rem] items-center gap-3 rounded-2xl px-3.5 py-2 text-left text-[13px] transition-transform hover:-translate-y-0.5"
                  style={raised(move.onLine)}
                >
                  <span className="text-[16px] font-extrabold">{figurineMove(move.san, position.ply + 1)}</span>
                  <span className="relative h-2.5 rounded-full" style={{ background: move.onLine ? 'oklch(1 0 0 / 0.2)' : COLOURS.sand }}>
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${move.share * 100}%`, background: move.onLine ? COLOURS.cream : COLOURS.leafSoft }} />
                  </span>
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
      )}
      {position.hidden > 0 && (
        <p className="text-[12px]" style={{ color: COLOURS.leafSoft }}>
          +{position.hidden} played fewer than 3 times
        </p>
      )}
    </section>
  );
}

function StepButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="size-9 rounded-full text-[16px] font-bold disabled:opacity-30" style={tile(COLOURS.sand)}>
      {label}
    </button>
  );
}
