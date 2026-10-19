import { useMemo } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { figurineMove, formatLine } from '../domain/notation';
import type { Priority } from '../domain/priorities';
import { ArrowBoard, type BoardArrow } from '../line/ArrowBoard';
import { replayLine } from '../position/replay';
import type { SessionStep } from '../session/steps';
import { COLOURS, REPERTOIRE } from '../workshop/theme';
import type { MapNode } from './repertoireMap';

interface PositionPaneProps {
  node: MapNode;
  flipped: boolean;
  /** Les étapes de la séance qui tombent sur cette position. */
  steps: readonly SessionStep[];
  priority?: Priority;
}

/** Le volet en lecture seule de la brique 1 : la position, ce que le répertoire y prévoit, ce qui l'attend. */
export function PositionPane({ node, flipped, steps, priority }: PositionPaneProps) {
  const fens = useMemo(() => replayLine(node.path).fens, [node.path]);
  const opening = useOpeningName(fens);
  const ply = node.ply + 1;
  const planned = node.children.map((child) => child.san!);
  const arrows = useMemo((): BoardArrow[] => {
    const played = steps.map((step): BoardArrow => ({ san: step.played, kind: 'neutral', share: 0.5, emphasis: true }));
    return [...planned.map((san): BoardArrow => ({ san, kind: 'repertoire', share: 0.5 })), ...played];
  }, [planned, steps]);

  return (
    <aside aria-label="Position" className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
      <ArrowBoard path={node.path} flipped={flipped} arrows={arrows} />
      <div className="flex min-w-0 flex-col px-1">
        <span className="truncate text-[19px] font-semibold tracking-[-0.01em]">
          {opening?.name ?? (node.path.length ? 'Unnamed line' : 'Starting position')}
        </span>
        <span className="truncate text-[14px]" style={{ color: COLOURS.leafSoft }}>
          {formatLine(node.path) || '—'}
        </span>
      </div>
      <p className="px-1 text-[14px]" style={{ color: COLOURS.leafSoft }}>
        <span className="font-semibold">Repertoire </span>
        {planned.length ? (
          <span style={{ color: REPERTOIRE }} className="font-bold">
            {planned.map((san) => figurineMove(san, ply)).join(' · ')}
          </span>
        ) : (
          'nothing planned here'
        )}
        {node.games > 0 && <span> · {node.games} games in 12 months</span>}
      </p>
      {steps.length > 0 && (
        <section aria-label="To settle" className="flex flex-col gap-1 rounded-2xl px-4 py-3 text-[14px]" style={{ background: COLOURS.cream }}>
          <span className="font-bold" style={{ color: COLOURS.terracotta }}>
            {node.toSettle} {node.toSettle === 1 ? 'game' : 'games'} to settle
          </span>
          {steps.map((step) => (
            <span key={step.key}>
              {step.kind === 'left' ? 'You' : 'They'} played <strong>{figurineMove(step.played, ply)}</strong> in {step.games.length}{' '}
              {step.games.length === 1 ? 'game' : 'games'}
            </span>
          ))}
        </section>
      )}
      {priority && (
        <section aria-label="Priority" className="flex flex-col gap-1 rounded-2xl px-4 py-3 text-[14px]" style={{ background: COLOURS.leaf, color: COLOURS.cream }}>
          <span className="font-bold">Priority {node.priority}</span>
          <span>
            {Math.round(priority.pointsToGain)} points to gain · {priority.games} games in 12 months
          </span>
        </section>
      )}
      <p className="px-1 text-[12px]" style={{ color: COLOURS.leafSoft }}>
        Brick 1: a read-only pane. Actions and “Next” come with brick 2.
      </p>
    </aside>
  );
}
