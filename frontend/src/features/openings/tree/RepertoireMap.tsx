import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { figurineLine } from '../domain/notation';
import { isPlayerMove } from '../domain/openingTree';
import type { Side } from '../domain/playedGame';
import { WorkshopBoard } from '../board/WorkshopBoard';
import { COLOURS, REPERTOIRE } from '../workshop/theme';
import { visibleNodes, type Folding } from './fold';
import { FONT_SIZE, layoutMap, PILL_HEIGHT, ROW, type PlacedNode } from './mapLayout';
import { withPreview, type MapNode } from './repertoireMap';
import { useElementSize, usePanZoom, type Box } from './usePanZoom';

export const LANDING_DEPTH = 6;
// Sous cette part des parties du camp, une ligne se replie à l'arrivée (comme le Pruned du flame graph).
const LANDING_SHARE = 0.02;
const NO_PREVIEW: readonly (readonly string[])[] = [];

interface RepertoireMapProps {
  root: MapNode;
  side: Side;
  selected: string;
  onSelect: (key: string) => void;
  /** Clé d'un nœud à rendre visible, centré ou non ; change à chaque demande. */
  focus: { key: string; stamp: number; centre: boolean } | null;
  /** Pendant une construction, la carte reste sous les yeux mais ne change plus de position. */
  locked?: boolean;
  /** Les lignes de la construction en cours, dessinées en fantômes. */
  preview?: readonly (readonly string[])[];
}

interface Hover {
  placed: PlacedNode;
  x: number;
  y: number;
}

export function RepertoireMap({ root: drawn, side, selected, onSelect, focus, locked = false, preview = NO_PREVIEW }: RepertoireMapProps) {
  const root = useMemo(() => withPreview(drawn, preview), [drawn, preview]);
  const container = useRef<HTMLDivElement>(null);
  const size = useElementSize(container);
  const { transform, handlers, dragged, reveal, zoomBy, fit } = usePanZoom(container);
  const [folding, setFolding] = useState<Folding>({ opened: new Set(), closed: new Set(), revealed: new Set() });
  const [hover, setHover] = useState<Hover | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pills = useRef(new Map<string, SVGGElement>());

  // La sélection et la construction en cours restent dépliées, quoi qu'il arrive à la carte autour.
  const kept = useMemo(
    () => ({ ...folding, revealed: new Set([...folding.revealed, selected, ...preview.map((line) => line.join(' '))]) }),
    [folding, selected, preview],
  );
  const layout = useMemo(() => layoutMap(root, visibleNodes(root, LANDING_DEPTH, LANDING_SHARE * root.games, kept)), [root, kept]);
  const maxGames = root.games || 1;

  // Un autre camp, une autre carte : le repli repart de zéro. Un nouveau jour ou un ajout ne touchent pas au repli
  // du joueur. Déclaré avant le dévoilement, qui doit lui survivre.
  useEffect(() => setFolding({ opened: new Set(), closed: new Set(), revealed: new Set() }), [side]);

  useEffect(() => {
    if (!focus) return;
    setFolding((current) => ({ ...current, revealed: new Set([focus.key]), closed: new Set() }));
  }, [focus]);

  // Le cadrage attend la taille du conteneur ; il ne touche pas au repli, sinon il effacerait le dévoilement.
  const fitted = useRef<Side | null>(null);
  useEffect(() => {
    if (fitted.current === side || !size.width) return;
    fitted.current = side;
    fit(layout.bounds, size);
  }, [side, size, layout.bounds, fit]);

  // Une demande de cadrage n'est servie qu'une fois, dès que son nœud est dessiné : déplier ailleurs ne doit pas ramener la carte.
  const served = useRef<number | null>(null);
  useEffect(() => {
    if (!focus || served.current === focus.stamp || !size.width) return;
    const placed = layout.nodes.find((node) => node.node.key === focus.key);
    if (!placed) return;
    served.current = focus.stamp;
    const along = focus.centre ? layout.nodes.filter((node) => focus.key === node.node.key || focus.key.startsWith(`${node.node.key} `) || node.node.san === null) : [placed];
    reveal(boxOf(along), size, focus.centre ? 0.8 : transform.k);
    // `transform.k` n'est lu qu'au moment de servir la demande.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, layout.nodes, reveal, size]);

  // La carte rétrécit quand le volet s'élargit (construction) : le nœud choisi doit rester dans le cadre.
  useEffect(() => {
    const placed = layout.nodes.find((node) => node.node.key === selected);
    if (placed && size.width) reveal(boxOf([placed]), size, 0);
    // Seul un changement de taille relance ce cadrage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  // Le focus clavier suit la sélection quand il est déjà dans la carte.
  useEffect(() => {
    if (!container.current?.contains(document.activeElement)) return;
    pills.current.get(selected)?.focus({ preventScroll: true });
  }, [selected]);

  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);
  const pointAt = (placed: PlacedNode, x: number, y: number) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (hover?.placed.node.key === placed.node.key) {
      setHover({ placed, x, y });
      return;
    }
    setHover(null);
    hoverTimer.current = setTimeout(() => setHover({ placed, x, y }), 350);
  };
  const leave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHover(null);
  };

  const open = (key: string) =>
    setFolding((current) => ({ ...current, opened: new Set([...current.opened, key]), closed: new Set([...current.closed].filter((k) => k !== key)) }));
  const close = (key: string) =>
    setFolding((current) => ({ ...current, opened: new Set([...current.opened].filter((k) => k !== key)), closed: new Set([...current.closed, key]) }));

  const select = (placed: PlacedNode) => {
    if (dragged.current || locked) return;
    onSelect(placed.node.owner ?? placed.node.key);
  };

  return (
    <div
      ref={container}
      className="relative h-full w-full touch-none overflow-hidden rounded-3xl"
      style={{ background: COLOURS.paper, cursor: 'grab', opacity: locked ? 0.55 : 1, transition: 'opacity 200ms' }}
    >
      <svg
        role="tree"
        aria-label="Repertoire"
        className="h-full w-full select-none"
        {...handlers}
        onPointerLeave={leave}
      >
        <style>{FOCUS_STYLE}</style>
        <g
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
            transformOrigin: '0 0',
            transition: transform.animate ? 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
          }}
        >
          {layout.edges.map(({ from, to }) => (
            <path
              key={to.node.key}
              d={edgePath(from, to)}
              fill="none"
              stroke={to.node.ghost ? COLOURS.kumquatDeep : to.node.stub ? COLOURS.sand : COLOURS.leafSoft}
              strokeOpacity={to.node.stub || to.node.ghost ? 1 : 0.55}
              strokeWidth={to.node.ghost ? 1.8 : 1 + 9 * Math.sqrt(to.node.games / maxGames)}
              strokeDasharray={to.node.stub ? '3 4' : to.node.ghost ? '5 4' : undefined}
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
              onHover={(x, y) => pointAt(placed, x, y)}
              onLeave={leave}
              register={(element) => {
                if (element) pills.current.set(placed.node.key, element);
                else pills.current.delete(placed.node.key);
              }}
            />
          ))}
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
        {locked ? <span /> : <Legend />}
        <div className="pointer-events-auto flex items-center gap-1 rounded-full p-1 text-[13px] font-semibold" style={{ background: COLOURS.cream, color: COLOURS.leaf }}>
          <MapButton label="Zoom out" onClick={() => zoomBy(1 / 1.25, size)}>
            −
          </MapButton>
          <span className="w-11 text-center tabular-nums" style={{ color: COLOURS.leafSoft }} aria-label="Zoom level">
            {Math.round(transform.k * 100)}%
          </span>
          <MapButton label="Zoom in" onClick={() => zoomBy(1.25, size)}>
            +
          </MapButton>
          <MapButton label="Fit the map" onClick={() => fit(layout.bounds, size)}>
            Fit
          </MapButton>
        </div>
      </div>
      {hover && !dragged.current && <HoverBoard hover={hover} side={side} />}
    </div>
  );
}

const FOCUS_STYLE = `
  [role='treeitem']:focus { outline: none; }
  [role='treeitem']:focus-visible > rect.pill, [data-unfold]:focus-visible > rect { stroke: ${COLOURS.kumquatDeep}; stroke-width: 3px; }
`;

function boxOf(nodes: readonly PlacedNode[]): Box {
  const left = Math.min(...nodes.map((node) => node.x - node.width / 2)) - 16;
  const right = Math.max(...nodes.map((node) => node.x + node.width / 2 + 40));
  const top = Math.min(...nodes.map((node) => node.y)) - ROW;
  const bottom = Math.max(...nodes.map((node) => node.y)) + ROW;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="min-w-8 rounded-full px-2.5 py-1.5 font-bold focus-visible:outline-2"
      style={{ background: COLOURS.sand, color: COLOURS.leaf }}
    >
      {children}
    </button>
  );
}

/** Les trois encodages de la carte, et le repli. */
export function Legend({ className = 'hidden sm:flex' }: { className?: string }) {
  return (
    <ul aria-label="Legend" className={`flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-3 py-1.5 text-[12px] font-semibold ${className}`} style={{ background: COLOURS.cream, color: COLOURS.leafSoft }}>
      <li className="flex items-center gap-1.5">
        <span className="grid size-[18px] place-items-center rounded-full text-[10px] font-extrabold" style={{ background: COLOURS.leaf, color: COLOURS.cream }}>
          1
        </span>
        priority
      </li>
      <li className="flex items-center gap-1.5">
        <span className="grid h-[18px] min-w-[22px] place-items-center rounded-full px-1 text-[11px] font-extrabold text-white" style={{ background: COLOURS.terracotta }}>
          n
        </span>
        games to settle
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-[5px] w-6 rounded-full" style={{ background: COLOURS.leafSoft, opacity: 0.6 }} />
        thicker = played more
      </li>
      <li className="flex items-center gap-1.5">
        <span className="rounded-full px-1.5 text-[11px] font-bold" style={{ background: COLOURS.sand, color: COLOURS.leaf }}>
          +3
        </span>
        folded, click to open
      </li>
    </ul>
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
  register: (element: SVGGElement | null) => void;
}

function Pill({ placed, side, selected, onClick, onDoubleClick, onOpen, onHover, onLeave, register }: PillProps) {
  const { node, x, y, width, label, hidden } = placed;
  const mine = node.san !== null && isPlayerMove(side, node.ply);
  const ghost = node.ghost === true;
  const fill = selected ? COLOURS.leaf : node.stub || ghost ? 'transparent' : mine ? COLOURS.cream : COLOURS.paper;
  const ink = selected ? COLOURS.cream : node.stub ? COLOURS.leafSoft : mine ? COLOURS.leaf : COLOURS.leafSoft;
  const stroke = ghost ? COLOURS.kumquatDeep : node.stub ? COLOURS.sand : mine ? REPERTOIRE : COLOURS.sand;
  const h = PILL_HEIGHT;
  const title = [
    node.san === null ? 'Starting position' : figurineLine(node.path),
    node.games ? `${node.games} ${node.games === 1 ? 'game' : 'games'}` : '',
    node.priority !== undefined ? `priority ${node.priority}` : '',
    node.toSettle ? `${node.toSettle} ${node.toSettle === 1 ? 'game' : 'games'} to settle` : '',
    hidden ? `${hidden} folded, press + to unfold` : '',
    ghost ? 'being added' : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <g
      transform={`translate(${x} ${y})`}
      ref={register}
      role="treeitem"
      aria-label={title}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        } else if ((event.key === '+' || event.key === '=') && hidden > 0) {
          event.preventDefault();
          onOpen();
        } else if (event.key === '-' && node.children.length) {
          event.preventDefault();
          onDoubleClick();
        }
      }}
      onDoubleClick={onDoubleClick}
      onPointerEnter={(event) => onHover(event.clientX, event.clientY)}
      onPointerMove={(event) => onHover(event.clientX, event.clientY)}
      onPointerLeave={onLeave}
    >
      <rect x={-width / 2 - 4} y={-ROW / 2 + 1} width={width + 8} height={ROW - 2} fill="transparent" />
      <rect
        className="pill"
        x={-width / 2}
        y={-h / 2}
        width={width}
        height={h}
        rx={h / 2}
        fill={fill}
        stroke={selected ? COLOURS.leaf : stroke}
        strokeWidth={ghost ? 1.8 : mine && !node.stub ? 1.6 : 1}
        strokeDasharray={node.stub ? '2 3' : ghost ? '4 3' : undefined}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={FONT_SIZE}
        fontWeight={mine ? 700 : 500}
        fontStyle={node.stub ? 'italic' : undefined}
        fill={ink}
      >
        {label}
      </text>
      {node.toSettle > 0 && !node.stub && (
        <g transform={`translate(${width / 2 - 2} ${-h / 2 - 3})`} aria-hidden="true">
          <rect x={-11} y={-9} width={node.toSettle > 9 ? 28 : 22} height={18} rx={9} fill={COLOURS.terracotta} stroke={COLOURS.paper} strokeWidth={2} />
          <text x={node.toSettle > 9 ? 3 : 0} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={800} fill="white">
            {node.toSettle}
          </text>
        </g>
      )}
      {node.priority !== undefined && !node.stub && (
        <g transform={`translate(${-width / 2 + 2} ${-h / 2 - 3})`} aria-hidden="true">
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
          data-unfold=""
          tabIndex={-1}
          aria-label={`Unfold ${hidden} more after ${title}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            event.stopPropagation();
            onOpen();
          }}
        >
          <rect x={-2} y={-14} width={38} height={28} fill="transparent" />
          <rect x={0} y={-10} width={34} height={20} rx={10} fill={COLOURS.sand} />
          <text x={17} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill={COLOURS.leaf}>
            +{hidden}
          </text>
        </g>
      )}
    </g>
  );
}

function HoverBoard({ hover, side }: { hover: Hover; side: Side }) {
  // Au-dessus du pointeur et vers la gauche : les enfants d'un nœud sont à sa droite, il ne faut pas les cacher.
  const width = 188;
  const left = Math.min(Math.max(hover.x - width - 24, 8), window.innerWidth - width - 8);
  const top = hover.y - 250 > 8 ? hover.y - 250 : hover.y + 24;
  return (
    <div role="tooltip" className="pointer-events-none fixed z-40 flex flex-col gap-1.5" style={{ left, top, width }}>
      <WorkshopBoard path={hover.placed.node.path} flipped={side === 'b'} />
      <span className="rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ background: COLOURS.leaf, color: COLOURS.cream }}>
        {hover.placed.node.san === null ? 'Starting position' : figurineLine(hover.placed.node.path)}
        {hover.placed.node.games ? ` · ${hover.placed.node.games} games` : ''}
      </span>
    </div>
  );
}
