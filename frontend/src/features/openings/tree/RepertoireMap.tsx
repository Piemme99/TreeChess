import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { figurineLine } from '../domain/notation';
import { isPlayerMove } from '../domain/openingTree';
import type { Side } from '../domain/playedGame';
import { WorkshopBoard } from '../board/WorkshopBoard';
import { COLOURS, REPERTOIRE } from '../workshop/theme';
import { visibleNodes, type Folding } from './fold';
import { FONT_SIZE, layoutMap, PILL_HEIGHT, ROW, type PlacedNode } from './mapLayout';
import { withPreview, type MapNode } from './repertoireMap';
import { BOTTOM_BAR, useElementSize, usePanZoom, type Box } from './usePanZoom';

export const LANDING_DEPTH = 6;
// Sous cette part des parties du camp, une ligne se replie à l'arrivée (comme le Pruned du flame graph).
const LANDING_SHARES = [0.02, 0.03, 0.05, 0.08, 0.12, 0.2];
// L'échelle sous laquelle les coups ne se lisent plus (15 px à 100 %).
const READABLE = 0.9;
const NO_PREVIEW: readonly (readonly string[])[] = [];
// Les ajouts du joueur, teintés du vert du répertoire pour qu'il retrouve son travail.
const ADDED = 'oklch(0.91 0.06 162)';

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
  const { transform, handlers, dragged, reveal, zoomBy, fit, setTransform } = usePanZoom(container);
  const pan = (dx: number) => setTransform((current) => ({ ...current, x: current.x + dx, animate: true }));
  const [folding, setFolding] = useState<Folding>({ opened: new Set(), closed: new Set(), revealed: new Set() });
  const [hover, setHover] = useState<Hover | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pills = useRef(new Map<string, SVGGElement>());

  // La sélection et la construction en cours restent dépliées, quoi qu'il arrive à la carte autour.
  const kept = useMemo(
    () => ({ ...folding, revealed: new Set([...folding.revealed, selected, ...preview.map((line) => line.join(' '))]) }),
    [folding, selected, preview],
  );
  // Plutôt replier que réduire : on monte le seuil de parties jusqu'à ce que la carte tienne en hauteur à taille de
  // lecture. En largeur, les lignes marquées vont aussi loin qu'il faut : le bord signale ce qui dépasse.
  const room = Math.max(0, size.height - BOTTOM_BAR - 24);
  const layout = useMemo(() => {
    let best = layoutMap(root, visibleNodes(root, LANDING_DEPTH, LANDING_SHARES[0] * root.games, kept));
    for (const share of LANDING_SHARES.slice(1)) {
      if (!room || best.bounds.height * READABLE <= room) break;
      best = layoutMap(root, visibleNodes(root, LANDING_DEPTH, share * root.games, kept));
    }
    return best;
  }, [root, kept, room]);
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
    fit(layout.bounds, size, READABLE);
  }, [side, size, layout.bounds, fit]);

  // « Fit » replie d'abord comme à l'arrivée, puis cadre la carte ainsi repliée.
  const refit = useRef(false);
  // « Fit » montre toute la carte, quitte à la réduire ; l'arrivée, elle, garde la taille de lecture.
  const wholeFit = useRef(false);
  useEffect(() => {
    if (!refit.current) return;
    refit.current = false;
    fit(layout.bounds, size, wholeFit.current ? 0.5 : READABLE);
    wholeFit.current = false;
  }, [layout.bounds, fit, size]);
  const anchor = () => {
    const placed = layout.nodes.find((node) => node.node.key === selected);
    return placed ? { x: placed.x * transform.k + transform.x, y: placed.y * transform.k + transform.y } : undefined;
  };
  // Ce qui dépasse du cadre se signale sur son bord, avec de quoi y aller.
  const overflow = {
    left: layout.bounds.x * transform.k + transform.x < -4,
    right: (layout.bounds.x + layout.bounds.width) * transform.k + transform.x > size.width + 4,
  };

  // Une demande de cadrage n'est servie qu'une fois, dès que son nœud est dessiné : déplier ailleurs ne doit pas ramener la carte.
  const served = useRef<number | null>(null);
  useEffect(() => {
    if (!focus || served.current === focus.stamp || !size.width) return;
    const placed = layout.nodes.find((node) => node.node.key === focus.key);
    if (!placed) return;
    served.current = focus.stamp;
    // Le chemin depuis le départ, pas le nœud seul : sans ses ancêtres, le joueur ne sait plus où il est.
    // Le chemin depuis le départ et les enfants du nœud : la carte bouge le moins possible, et ne dézoome
    // qu'un peu, jusqu'à 75 %, pour garder le départ en vue ; au-delà, le nœud et sa suite passent d'abord.
    const along = layout.nodes.filter(
      (node) => node === placed || focus.key.startsWith(`${node.node.key} `) || node.node.san === null || (node.node.key.startsWith(`${focus.key} `) && node.node.path.length === placed.node.path.length + 1),
    );
    reveal(boxOf(along), size, Math.min(transform.k, 0.75));
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
  // Au clavier, l'aperçu du survol resterait figé sur un nœud qu'on a quitté.
  useEffect(() => {
    const hide = () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      setHover(null);
    };
    window.addEventListener('keydown', hide);
    return () => window.removeEventListener('keydown', hide);
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
    leave();
    if (dragged.current || locked) return;
    onSelect(placed.node.owner ?? placed.node.key);
  };

  return (
    <div className="flex h-full flex-col gap-2">
    <div
      ref={container}
      className="relative min-h-0 w-full flex-1 touch-none overflow-hidden rounded-3xl"
      style={{ background: COLOURS.paper, cursor: 'grab', opacity: locked ? 0.85 : 1, transition: 'opacity 200ms' }}
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
      {overflow.right && <EdgeHint side="right" onClick={() => pan(-size.width * 0.5)} />}
      {overflow.left && <EdgeHint side="left" onClick={() => pan(size.width * 0.5)} />}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-end gap-3 p-3">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full p-1 text-[13px] font-semibold" style={{ background: COLOURS.cream, color: COLOURS.leaf }}>
          <MapButton label="Zoom out" onClick={() => zoomBy(1 / 1.25, size, anchor())}>
            −
          </MapButton>
          <span className="w-11 text-center tabular-nums" style={{ color: COLOURS.leafSoft }} aria-label="Zoom level">
            {Math.round(transform.k * 100)}%
          </span>
          <MapButton label="Zoom in" onClick={() => zoomBy(1.25, size, anchor())}>
            +
          </MapButton>
          <MapButton
            label="Fit the map"
            onClick={() => {
              setFolding({ opened: new Set(), closed: new Set(), revealed: new Set() });
              refit.current = true;
              wholeFit.current = true;
            }}
          >
            Fit
          </MapButton>
        </div>
      </div>
      {hover && !dragged.current && <HoverBoard hover={hover} side={side} frame={container.current?.getBoundingClientRect()} />}
    </div>
      <Legend />
    </div>
  );
}

const FOCUS_STYLE = `
  [role='treeitem']:focus { outline: none; }
  [role='treeitem']:focus-visible > rect.pill, [data-unfold]:focus-visible > rect { stroke: ${COLOURS.leaf}; stroke-width: 3px; stroke-dasharray: none; }
`;

function boxOf(nodes: readonly PlacedNode[]): Box {
  const left = Math.min(...nodes.map((node) => node.x - node.width / 2)) - 16;
  const right = Math.max(...nodes.map((node) => node.x + node.width / 2 + 40));
  const top = Math.min(...nodes.map((node) => node.y)) - ROW;
  const bottom = Math.max(...nodes.map((node) => node.y)) + ROW;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function EdgeHint({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const right = side === 'right';
  return (
    <div
      className={`pointer-events-none absolute inset-y-0 ${right ? 'right-0' : 'left-0'} flex w-14 items-center justify-center`}
      style={{ background: `linear-gradient(to ${right ? 'left' : 'right'}, ${COLOURS.paper} 30%, oklch(0.985 0.012 85 / 0))` }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={right ? 'More of the map to the right' : 'More of the map to the left'}
        title={right ? 'More to the right' : 'More to the left'}
        className="pointer-events-auto grid size-9 place-items-center rounded-full text-[20px] font-bold focus-visible:outline-2"
        style={{ background: COLOURS.sand, color: COLOURS.leaf, boxShadow: '0 2px 6px -2px oklch(0.35 0.06 60 / 0.35)' }}
      >
        {right ? '›' : '‹'}
      </button>
    </div>
  );
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
function Legend() {
  return (
    <ul aria-label="Legend" className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 text-[12px] font-semibold" style={{ color: COLOURS.leafSoft }}>
      <li className="flex items-center gap-1.5">
        <span className="rounded px-1 text-[10px] font-extrabold" style={{ background: COLOURS.leaf, color: COLOURS.cream }}>
          P1
        </span>
        priority, by rank
      </li>
      <li className="flex items-center gap-1.5">
        <span className="grid h-[18px] min-w-[22px] place-items-center rounded-full px-1 text-[11px] font-extrabold text-white" style={{ background: COLOURS.terracotta }}>
          n
        </span>
        games to settle
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-[14px] w-6 rounded-full" style={{ background: COLOURS.cream, boxShadow: `inset 0 0 0 1.5px ${REPERTOIRE}` }} />
        your move
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-[14px] w-6 rounded-full" style={{ background: ADDED, boxShadow: `inset 0 0 0 1.5px ${REPERTOIRE}` }} />
        your additions
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-[14px] w-6 rounded-full" style={{ boxShadow: `inset 0 0 0 1.5px ${COLOURS.kumquatDeep}`, outline: `1px dashed ${COLOURS.kumquatDeep}`, outlineOffset: -1 }} />
        being added
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
  const fill = selected ? COLOURS.leaf : node.stub || ghost ? 'transparent' : node.added ? ADDED : mine ? COLOURS.cream : COLOURS.paper;
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
          <text x={node.toSettle > 9 ? 3 : 0} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={800} fill="white">
            {node.toSettle}
          </text>
        </g>
      )}
      {node.priority !== undefined && !node.stub && (
        <g transform={`translate(${-width / 2 - 13} 0)`} aria-hidden="true">
          <rect x={-12} y={-8} width={24} height={16} rx={4} fill={COLOURS.leaf} stroke={COLOURS.paper} strokeWidth={2} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={800} fill={COLOURS.cream}>
            P{node.priority}
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
          <text x={17} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700} fill={COLOURS.leaf}>
            +{hidden}
          </text>
        </g>
      )}
    </g>
  );
}

function HoverBoard({ hover, side, frame }: { hover: Hover; side: Side; frame: DOMRect | undefined }) {
  // Toujours au même coin de la carte, loin du pointeur : il ne cache pas la branche qu'on manipule.
  const width = 188;
  const nearLeft = frame !== undefined && hover.x < frame.left + width + 40 && hover.y < frame.top + 260;
  const left = frame ? (nearLeft ? frame.right - width - 12 : frame.left + 12) : hover.x + 16;
  const top = frame ? frame.top + 12 : hover.y + 16;
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
