import { useEffect, useMemo, useRef, useState } from 'react';
import { figurineLine } from '../domain/notation';
import { isPlayerMove } from '../domain/openingTree';
import type { Side } from '../domain/playedGame';
import { WorkshopBoard } from '../board/WorkshopBoard';
import { COLOURS, REPERTOIRE } from '../workshop/theme';
import { visibleNodes, type Folding } from './fold';
import { layoutMap, PILL_HEIGHT, type PlacedNode } from './mapLayout';
import type { MapNode } from './repertoireMap';
import { useElementSize, usePanZoom } from './usePanZoom';

export const LANDING_DEPTH = 6;
// Sous cette part des parties du camp, une ligne se replie à l'arrivée (comme le Pruned du flame graph).
const LANDING_SHARE = 0.02;

interface RepertoireMapProps {
  root: MapNode;
  side: Side;
  selected: string;
  onSelect: (key: string) => void;
  /** Clé d'un nœud à rendre visible, centré ou non ; change à chaque demande. */
  focus: { key: string; stamp: number; centre: boolean } | null;
}

interface Hover {
  placed: PlacedNode;
  x: number;
  y: number;
}

export function RepertoireMap({ root, side, selected, onSelect, focus }: RepertoireMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const size = useElementSize(container);
  const { transform, handlers, dragged, centreOn, fit } = usePanZoom(container);
  const [folding, setFolding] = useState<Folding>({ opened: new Set(), closed: new Set(), revealed: new Set() });
  const [hover, setHover] = useState<Hover | null>(null);

  const layout = useMemo(() => layoutMap(root, visibleNodes(root, LANDING_DEPTH, LANDING_SHARE * root.games, folding)), [root, folding]);
  const maxGames = root.games || 1;

  const fitted = useRef<MapNode | null>(null);
  useEffect(() => {
    if (fitted.current === root || !size.width) return;
    fitted.current = root;
    setFolding({ opened: new Set(), closed: new Set(), revealed: new Set() });
    fit(layout.bounds, size);
  }, [root, size, layout.bounds, fit]);

  useEffect(() => {
    if (!focus) return;
    setFolding((current) => ({ ...current, revealed: new Set([focus.key]), closed: new Set() }));
  }, [focus]);

  useEffect(() => {
    if (!focus || !focus.centre) return;
    const placed = layout.nodes.find((node) => node.node.key === focus.key);
    if (placed) centreOn({ x: placed.x, y: placed.y }, { x: size.width * 0.4, y: size.height / 2 });
  }, [focus, layout.nodes, centreOn, size]);

  const open = (key: string) =>
    setFolding((current) => ({ ...current, opened: new Set([...current.opened, key]), closed: new Set([...current.closed].filter((k) => k !== key)) }));
  const close = (key: string) =>
    setFolding((current) => ({ ...current, opened: new Set([...current.opened].filter((k) => k !== key)), closed: new Set([...current.closed, key]) }));

  const select = (placed: PlacedNode) => {
    if (dragged.current) return;
    onSelect(placed.node.owner ?? placed.node.key);
  };

  return (
    <div ref={container} className="relative h-full w-full touch-none overflow-hidden rounded-3xl" style={{ background: COLOURS.paper, cursor: 'grab' }}>
      <svg
        role="tree"
        aria-label="Repertoire"
        className="h-full w-full select-none"
        {...handlers}
        onPointerLeave={() => setHover(null)}
      >
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
          {layout.edges.map(({ from, to }) => (
            <path
              key={to.node.key}
              d={edgePath(from, to)}
              fill="none"
              stroke={to.node.stub ? COLOURS.sand : COLOURS.leafSoft}
              strokeOpacity={to.node.stub ? 1 : 0.55}
              strokeWidth={1 + 9 * Math.sqrt(to.node.games / maxGames)}
              strokeDasharray={to.node.stub ? '3 4' : undefined}
              strokeLinecap="round"
            />
          ))}
          {layout.nodes.map((placed) => (
            <Pill
              key={placed.node.key}
              placed={placed}
              side={side}
              selected={placed.node.key === selected}
              onClick={() => select(placed)}
              onDoubleClick={() => placed.node.children.length && !placed.hidden && close(placed.node.key)}
              onOpen={() => open(placed.node.key)}
              onHover={(x, y) => setHover({ placed, x, y })}
              onLeave={() => setHover(null)}
            />
          ))}
        </g>
      </svg>
      <div className="absolute right-3 top-3 flex items-center gap-2 text-[12px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        <span>{Math.round(transform.k * 100)}%</span>
        <button type="button" className="rounded-full px-3 py-1" style={{ background: COLOURS.sand, color: COLOURS.leaf }} onClick={() => fit(layout.bounds, size)}>
          Fit
        </button>
      </div>
      {hover && !dragged.current && <HoverBoard hover={hover} side={side} />}
    </div>
  );
}


function edgePath(from: PlacedNode, to: PlacedNode): string {
  const x1 = from.x + from.width / 2;
  const x2 = to.x - to.width / 2;
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${x2} ${to.y}`;
}

interface PillProps {
  placed: PlacedNode;
  side: Side;
  selected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onOpen: () => void;
  onHover: (x: number, y: number) => void;
  onLeave: () => void;
}

function Pill({ placed, side, selected, onClick, onDoubleClick, onOpen, onHover, onLeave }: PillProps) {
  const { node, x, y, width, label, hidden } = placed;
  const mine = node.san !== null && isPlayerMove(side, node.ply);
  const fill = selected ? COLOURS.leaf : node.stub ? 'transparent' : mine ? COLOURS.cream : COLOURS.paper;
  const ink = selected ? COLOURS.cream : node.stub ? COLOURS.leafSoft : mine ? COLOURS.leaf : COLOURS.leafSoft;
  const stroke = node.stub ? COLOURS.sand : mine ? REPERTOIRE : COLOURS.sand;
  const h = PILL_HEIGHT;
  const title = node.san === null ? 'Starting position' : figurineLine(node.path);

  return (
    <g
      transform={`translate(${x} ${y})`}
      role="treeitem"
      aria-label={title}
      aria-selected={selected}
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerEnter={(event) => onHover(event.clientX, event.clientY)}
      onPointerMove={(event) => onHover(event.clientX, event.clientY)}
      onPointerLeave={onLeave}
    >
      <rect
        x={-width / 2}
        y={-h / 2}
        width={width}
        height={h}
        rx={h / 2}
        fill={fill}
        stroke={selected ? COLOURS.leaf : stroke}
        strokeWidth={mine && !node.stub ? 1.6 : 1}
        strokeDasharray={node.stub ? '2 3' : undefined}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={13}
        fontWeight={mine ? 700 : 500}
        fontStyle={node.stub ? 'italic' : undefined}
        fill={ink}
      >
        {label}
      </text>
      {node.toSettle > 0 && !node.stub && (
        <g transform={`translate(${width / 2 - 4} ${-h / 2 + 2})`} aria-label={`${node.toSettle} games to settle`}>
          <rect x={-11} y={-9} width={node.toSettle > 9 ? 28 : 22} height={18} rx={9} fill={COLOURS.terracotta} stroke={COLOURS.paper} strokeWidth={2} />
          <text x={node.toSettle > 9 ? 3 : 0} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={800} fill="white">
            {node.toSettle}
          </text>
        </g>
      )}
      {node.priority !== undefined && !node.stub && (
        <g transform={`translate(${-width / 2 + 4} ${-h / 2 + 2})`} aria-label={`priority ${node.priority}`}>
          <circle r={9} fill={COLOURS.leaf} stroke={COLOURS.paper} strokeWidth={2} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={800} fill={COLOURS.cream}>
            {node.priority}
          </text>
        </g>
      )}
      {hidden > 0 && (
        <g
          transform={`translate(${width / 2 + 6} 0)`}
          role="button"
          aria-label={`unfold ${hidden} more`}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          <rect x={0} y={-9} width={30} height={18} rx={9} fill={COLOURS.sand} />
          <text x={15} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700} fill={COLOURS.leaf}>
            +{hidden}
          </text>
        </g>
      )}
    </g>
  );
}

function HoverBoard({ hover, side }: { hover: Hover; side: Side }) {
  const flipped = hover.x > window.innerWidth - 260;
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-40 flex w-[188px] flex-col gap-1.5"
      style={{ left: flipped ? undefined : hover.x + 16, right: flipped ? window.innerWidth - hover.x + 16 : undefined, top: hover.y + 16 }}
    >
      <WorkshopBoard path={hover.placed.node.path} flipped={side === 'b'} />
      <span className="rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ background: COLOURS.leaf, color: COLOURS.cream }}>
        {hover.placed.node.san === null ? 'Starting position' : figurineLine(hover.placed.node.path)}
        {hover.placed.node.games ? ` · ${hover.placed.node.games} games` : ''}
      </span>
    </div>
  );
}
