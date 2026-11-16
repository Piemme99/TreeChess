import { useMemo, type ReactNode } from 'react';
import { figurineMove } from '../domain/notation';
import { isPlayerMove } from '../domain/openingTree';
import type { Side } from '../domain/playedGame';
import { COLOURS, REPERTOIRE, tile } from '../workshop/theme';
import type { MapNode } from './repertoireMap';

interface Below {
  settle: number;
  priority?: number;
  added: boolean;
}

/** Ce que porte un nœud et tout ce qui est sous lui : sur la liste, on ne voit qu'un étage à la fois. */
function marksBelow(root: MapNode): Map<string, Below> {
  const marks = new Map<string, Below>();
  const walk = (node: MapNode): Below => {
    const below: Below = node.stub ? { settle: 0, added: false } : { settle: node.toSettle, priority: node.priority, added: node.added === true };
    for (const child of node.children) {
      const sub = walk(child);
      below.settle += sub.settle;
      if (sub.priority !== undefined && (below.priority === undefined || sub.priority < below.priority)) below.priority = sub.priority;
      below.added ||= sub.added;
    }
    marks.set(node.key, below);
    return below;
  };
  walk(root);
  return marks;
}

interface TreeListProps {
  root: MapNode;
  side: Side;
  node: MapNode;
  onSelect: (key: string) => void;
  onOpen: () => void;
}

/** L'arbre au téléphone : un étage à la fois, comme l'explorateur de Lichess, avec ce qui attend plus bas. */
export function TreeList({ root, side, node, onSelect, onOpen }: TreeListProps) {
  const marks = useMemo(() => marksBelow(root), [root]);
  const children = [...node.children].sort((a, b) => b.games - a.games);
  const most = Math.max(1, ...children.map((child) => child.games));
  const ancestors = node.path.map((_, index) => node.path.slice(0, index + 1).join(' '));
  const mine = isPlayerMove(side, node.ply + 1);

  return (
    <section aria-label="Repertoire" className="flex flex-col gap-3 rounded-3xl p-3" style={{ background: COLOURS.paper }}>
      <nav aria-label="Line" className="flex flex-wrap items-center gap-1 text-[14px] font-semibold">
        <Crumb active={node.san === null} onClick={() => onSelect('')}>
          Start
        </Crumb>
        {node.path.map((san, index) => (
          <Crumb key={ancestors[index]} active={index === node.path.length - 1} onClick={() => onSelect(ancestors[index])}>
            {figurineMove(san, index + 1)}
          </Crumb>
        ))}
      </nav>
      <div className="flex items-center justify-between gap-3 px-1">
        <span className="text-[13px] font-semibold" style={{ color: COLOURS.leafSoft }}>
          {children.length ? (mine ? 'Your moves here' : 'Their replies you have prepared') : mine ? 'Your repertoire stops here' : 'No reply prepared yet'}
        </span>
        <button type="button" onClick={onOpen} className="rounded-full px-3 py-2 text-[13px] font-bold focus-visible:outline-2" style={{ background: COLOURS.leaf, color: COLOURS.cream }}>
          See the board →
        </button>
      </div>
      {children.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {children.map((child) => {
            const below = marks.get(child.key)!;
            return (
              <li key={child.key}>
                <button
                  type="button"
                  onClick={() => onSelect(child.owner ?? child.key)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left focus-visible:outline-2"
                  style={tile(COLOURS.cream)}
                >
                  <span className="w-20 shrink-0 text-[16px] font-extrabold" style={{ color: mine ? REPERTOIRE : COLOURS.leaf }}>
                    {figurineMove(child.san!, child.ply)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="h-2 overflow-hidden rounded-full" style={{ background: COLOURS.sand }}>
                      <span className="block h-full rounded-full" style={{ width: `${(child.games / most) * 100}%`, background: COLOURS.leafSoft }} />
                    </span>
                    <span className="text-[12px]" style={{ color: COLOURS.leafSoft }}>
                      {child.stub ? 'same position as another line' : `${child.games} ${child.games === 1 ? 'game' : 'games'} in 12 months`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {below.priority !== undefined && (
                      <span className="grid size-6 place-items-center rounded-full text-[11px] font-extrabold" style={{ background: COLOURS.leaf, color: COLOURS.cream }} title="Priority">
                        {below.priority}
                      </span>
                    )}
                    {below.settle > 0 && (
                      <span className="grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[12px] font-extrabold text-white" style={{ background: COLOURS.terracotta }} title="Games to settle">
                        {below.settle}
                      </span>
                    )}
                    <span aria-hidden="true" className="pl-1 text-[18px]" style={{ color: COLOURS.leafSoft }}>
                      ›
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="px-1 text-[12px]" style={{ color: COLOURS.leafSoft }}>
        <span className="font-bold" style={{ color: COLOURS.leaf }}>
          ●
        </span>{' '}
        priority ·{' '}
        <span className="font-bold" style={{ color: COLOURS.terracotta }}>
          ●
        </span>{' '}
        games to settle, on this move or further down
      </p>
    </section>
  );
}

function Crumb({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'location' : undefined}
      className="rounded-full px-2.5 py-1.5 focus-visible:outline-2"
      style={active ? { background: COLOURS.leaf, color: COLOURS.cream } : tile(COLOURS.sand)}
    >
      {children}
    </button>
  );
}
