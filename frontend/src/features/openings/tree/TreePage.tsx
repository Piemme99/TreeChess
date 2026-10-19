import { MotionConfig, motion } from 'framer-motion';
import { useMemo, useState, type ReactNode } from 'react';
import { buildOpeningTree } from '../domain/openingTree';
import { figurineLine } from '../domain/notation';
import { gamesOfLastMonths } from '../domain/period';
import type { PlayedGame, Side } from '../domain/playedGame';
import { findPriorities } from '../domain/priorities';
import { ReplayBar } from '../replay/ReplayBar';
import type { SessionStep } from '../session/steps';
import { useReplayedSession } from '../session/useReplayedSession';
import { PageHeader } from '../workshop/PageHeader';
import { SideSwitch } from '../workshop/SideSwitch';
import { COLOURS, FONT_FAMILY, raised, SPRING } from '../workshop/theme';
import { useWorkshopFont } from '../workshop/useWorkshopFont';
import { PositionPane } from './PositionPane';
import { RepertoireMap } from './RepertoireMap';
import { buildRepertoireMap, forEachNode, markedNodes, type MapNode } from './repertoireMap';

const MAX_PLIES = 24;
const RECENT_MONTHS = 12;
const MAX_PRIORITIES = 5;

/** POC (README, « the tree as the landing screen ») : le répertoire comme carte, à côté de l'aiguillage pour comparer. */
export function TreePage() {
  useWorkshopFont();
  const { replay, known, repertoires, steps, forgetIgnored, forgetAdditions } = useReplayedSession();
  const [side, setSide] = useState<Side>('w');
  const [selected, setSelected] = useState<Record<Side, string>>({ w: '', b: '' });
  const [focus, setFocus] = useState<{ key: string; stamp: number } | null>(null);

  const { maps, priorities } = useMaps(known, replay.day, repertoires, steps);
  const root = maps[side];
  const node = useMemo(() => findNode(root, selected[side]) ?? root, [root, selected, side]);
  const marked = useMemo(() => markedNodes(root), [root]);
  const stepsHere = useMemo(() => steps.filter((step) => step.side === side && step.games[0].check.position === node.position), [steps, side, node]);
  const priority = node.priority !== undefined ? priorities[node.priority - 1] : undefined;

  const goTo = (target: Side, key: string) => {
    setSide(target);
    setSelected((current) => ({ ...current, [target]: key }));
    setFocus({ key, stamp: Date.now() });
  };
  const firstStep = steps[0];
  const firstStepNode = firstStep && findByPosition(maps[firstStep.side], firstStep.games[0].check.position);
  const firstPriority = priorities[0];
  const firstPriorityNode = firstPriority && markedNodes(maps[firstPriority.side]).priorities.find((candidate) => candidate.priority === 1);
  const positions = marked.toSettle.length;

  const reset = replay.reset && (() => {
    replay.reset!();
    forgetIgnored();
    forgetAdditions();
  });

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen pb-10" style={{ fontFamily: FONT_FAMILY, background: COLOURS.cream, color: COLOURS.leaf }}>
        <PageHeader>
          <span className="sm:ml-auto">
            <ReplayBar replay={{ ...replay, reset }} />
          </span>
        </PageHeader>
        <main className="mx-auto flex max-w-[84rem] flex-col gap-4 px-4 pt-5 sm:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <SideSwitch side={side} onChange={(next) => setSide(next)} />
            <span className="text-[14px]" style={{ color: COLOURS.leafSoft }}>
              {positions} {positions === 1 ? 'position' : 'positions'} to settle as {side === 'w' ? 'White' : 'Black'}
            </span>
            <span className="flex flex-wrap gap-2 sm:ml-auto">
              <Door onClick={firstStepNode ? () => goTo(firstStep.side, firstStepNode.key) : undefined} title={`${steps.length} to settle`}>
                {firstStep ? `${firstStep.games.length} games at ${figurineLine(firstStep.path) || 'the start'}` : 'nothing to settle'}
              </Door>
              <Door onClick={firstPriorityNode ? () => goTo(firstPriority.side, firstPriorityNode.key) : undefined} title="Priority 1">
                {firstPriority ? `${firstPriority.side === 'w' ? 'White' : 'Black'} · ${figurineLine(firstPriority.path)}` : 'no priority'}
              </Door>
            </span>
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="h-[60vh] min-h-[380px] lg:h-[calc(100vh-13rem)]">
              <RepertoireMap root={root} side={side} selected={node.key} onSelect={(key) => setSelected((current) => ({ ...current, [side]: key }))} focus={focus} />
            </div>
            <PositionPane key={`${side} ${node.key}`} node={node} flipped={side === 'b'} steps={stepsHere} priority={priority} />
          </div>
        </main>
      </div>
    </MotionConfig>
  );
}

function Door({ onClick, title, children }: { onClick?: () => void; title: string; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      whileHover={onClick ? { y: -2 } : undefined}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      transition={SPRING}
      className="flex flex-col items-start rounded-2xl px-4 py-2 text-left"
      style={{ ...raised(false), opacity: onClick ? 1 : 0.6 }}
    >
      <span className="text-[15px] font-extrabold tracking-[-0.01em]">{title}</span>
      <span className="text-[12px]" style={{ color: COLOURS.leafSoft }}>
        {children}
      </span>
    </motion.button>
  );
}

function useMaps(known: readonly PlayedGame[], day: string, repertoires: ReturnType<typeof useReplayedSession>['repertoires'], steps: readonly SessionStep[]) {
  return useMemo(() => {
    const trees = (games: readonly PlayedGame[]) => ({ w: buildOpeningTree(games, 'w', MAX_PLIES), b: buildOpeningTree(games, 'b', MAX_PLIES) });
    const recent = trees(gamesOfLastMonths(known, RECENT_MONTHS, new Date(day)));
    const priorities = findPriorities(trees(known), recent, MAX_PRIORITIES);
    const toSettle: Record<Side, Map<string, number>> = { w: new Map(), b: new Map() };
    for (const step of steps) {
      const position = step.games[0].check.position;
      toSettle[step.side].set(position, (toSettle[step.side].get(position) ?? 0) + step.games.length);
    }
    const maps: Record<Side, MapNode> = {
      w: buildRepertoireMap(repertoires.w, recent.w, { toSettle: toSettle.w, priorities }),
      b: buildRepertoireMap(repertoires.b, recent.b, { toSettle: toSettle.b, priorities }),
    };
    return { maps, priorities };
  }, [known, day, repertoires, steps]);
}

function findNode(root: MapNode, key: string): MapNode | undefined {
  let found: MapNode | undefined;
  forEachNode(root, (node) => {
    if (node.key === key && !node.stub) found = node;
  });
  return found;
}

function findByPosition(root: MapNode, position: string): MapNode | undefined {
  let found: MapNode | undefined;
  forEachNode(root, (node) => {
    if (!found && node.position === position && !node.stub) found = node;
  });
  return found;
}
