import { useEffect, useMemo, useRef } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { PlayableBoard } from '../board/PlayableBoard';
import { figurineMove } from '../domain/notation';
import { isPlayerMove } from '../domain/openingTree';
import type { Side } from '../domain/playedGame';
import { replayLine } from '../position/replay';
import { COLOURS, REPERTOIRE } from '../workshop/theme';
import { OffRepertoire, PriorityCard, SettleCard, type PositionPaneProps } from './PositionPane';
import { usePositionFacts } from './positionFacts';
import type { MapNode } from './repertoireMap';

interface PhonePaneProps extends PositionPaneProps {
  /** La ligne d'où l'on a reculé : sa suite reste visible, en grisé, comme sur Lichess. */
  trail: readonly string[];
  /** Aller à un nœud de la carte : un coup qui transpose mène à la ligne qui porte la position. */
  onSelect: (key: string) => void;
}

/** Le téléphone, comme l'analyse de Lichess : l'échiquier d'abord, la ligne dessous, puis ce qu'on peut jouer ici. */
export function PhonePane(props: PhonePaneProps) {
  const { side, path, trail, node, steps, priority, actions, onLead, onSkip, onNextPriority, onExtend, onPrepareFollows, onMove, onJump, onSelect } = props;
  const facts = usePositionFacts(props);
  const { inRepertoire, arrows, suggestions, prioritised, settling } = facts;

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-2">
        <PlayableBoard path={path} flipped={side === 'b'} arrows={arrows} suggestions={suggestions} onMove={onMove} />
      </div>
      <LineStrip path={path} trail={trail} known={node.path.length} onJump={onJump} />
      <div className="empty:hidden">
        {settling && <SettleCard steps={steps} facts={facts} actions={actions} onSkip={onSkip} rank={node.priority} />}
        {prioritised && !settling && (
          <PriorityCard side={side} priority={priority!} rank={node.priority!} total={props.priorityCount} facts={facts} waiting={steps.length} onLead={onLead} onNextPriority={onNextPriority} onPrepareFollows={onPrepareFollows} />
        )}
      </div>
      {inRepertoire ? (
        <MoveTable side={side} node={node} onSelect={onSelect} onExtend={onExtend} />
      ) : (
        <OffRepertoire path={path} node={node} facts={facts} onExtend={onExtend} onJump={onJump} />
      )}
    </div>
  );
}

/** Le nom de l'ouverture et la ligne jouée, qui défile comme la barre de coups de Lichess ; un coup y ramène. */
function LineStrip({ path, trail, known, onJump }: { path: readonly string[]; trail: readonly string[]; known: number; onJump: (path: readonly string[]) => void }) {
  const fens = useMemo(() => replayLine(path).fens, [path]);
  const opening = useOpeningName(fens);
  const line = trail.length > path.length && path.every((san, index) => trail[index] === san) ? trail : path;
  const strip = useRef<HTMLOListElement>(null);
  useEffect(() => {
    strip.current?.querySelector('[aria-current]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [path]);

  return (
    <div className="flex min-w-0 flex-col gap-1 px-1">
      <h2 className="text-[16px] font-bold leading-tight">{opening?.name ?? (path.length ? 'Unnamed line' : 'Starting position')}</h2>
      {line.length > 0 && (
        <ol
          aria-label="Line"
          ref={strip}
          className="-mx-1 flex gap-0.5 overflow-x-auto whitespace-nowrap px-1 text-[15px] [scrollbar-width:none]"
          style={{ maskImage: 'linear-gradient(to right, transparent, black 1rem, black calc(100% - 1rem), transparent)' }}
        >
          {line.map((san, index) => {
            const ply = index + 1;
            const current = ply === path.length;
            const ahead = ply > path.length;
            const off = index >= known && !ahead;
            return (
              <li key={index} className="flex items-baseline" style={{ opacity: ahead ? 0.45 : 1 }}>
                {ply % 2 === 1 && (
                  <span className="pl-1 text-[12px] tabular-nums" style={{ color: COLOURS.leafSoft }}>
                    {Math.ceil(ply / 2)}.
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onJump(line.slice(0, ply))}
                  aria-current={current ? 'step' : undefined}
                  className="min-h-10 min-w-9 rounded-md px-1.5 font-semibold focus-visible:outline-2"
                  style={current ? { background: off ? COLOURS.terracotta : COLOURS.leaf, color: COLOURS.cream } : { color: off ? COLOURS.terracotta : COLOURS.leaf }}
                >
                  {figurineMove(san, ply).replace(/^\d+(\.|…)/, '')}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

interface Below {
  settle: number;
  priority?: number;
}

/** Ce que porte un nœud et tout ce qui est sous lui : la liste ne montre qu'un étage à la fois. */
function marksBelow(root: MapNode): Map<string, Below> {
  const marks = new Map<string, Below>();
  const walk = (node: MapNode): Below => {
    const below: Below = node.stub ? { settle: 0 } : { settle: node.toSettle, priority: node.priority };
    for (const child of node.children) {
      const sub = walk(child);
      below.settle += sub.settle;
      if (sub.priority !== undefined && (below.priority === undefined || sub.priority < below.priority)) below.priority = sub.priority;
    }
    marks.set(node.key, below);
    return below;
  };
  walk(root);
  return marks;
}

/** Les coups du répertoire ici, comme le tableau de l'explorateur : un coup touché se joue. */
function MoveTable({ side, node, onSelect, onExtend }: { side: Side; node: MapNode; onSelect: (key: string) => void; onExtend: () => void }) {
  const marks = useMemo(() => marksBelow(node), [node]);
  const children = [...node.children].sort((a, b) => b.games - a.games);
  const total = Math.max(1, children.reduce((sum, child) => sum + child.games, 0));
  const mine = isPlayerMove(side, node.ply + 1);

  return (
    <section aria-label="Repertoire" className="flex flex-col overflow-hidden rounded-2xl" style={{ background: COLOURS.paper }}>
      <span className="flex items-baseline justify-between px-4 pt-3 pb-1.5 text-[12px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        <span>{mine ? 'Your moves' : 'Their replies'}</span>
        {children.length > 0 && <span>games · 12 months</span>}
      </span>
      <ul className="flex flex-col">
        {children.map((child) => {
          const below = marks.get(child.key)!;
          return (
            <li key={child.key} style={{ borderTop: `1px solid ${COLOURS.sand}` }}>
              <button type="button" onClick={() => onSelect(child.owner ?? child.key)} className="flex min-h-12 w-full items-center gap-3 px-4 text-left focus-visible:outline-2">
                <span className="w-[4.5rem] shrink-0 text-[16px] font-extrabold" style={{ color: mine ? REPERTOIRE : COLOURS.leaf }}>
                  {figurineMove(child.san!, child.ply)}
                </span>
                {child.stub ? (
                  <span className="flex-1 text-[13px]" style={{ color: COLOURS.leafSoft }}>
                    transposes
                  </span>
                ) : (
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: COLOURS.sand }}>
                    <span className="block h-full rounded-full" style={{ width: `${(child.games / total) * 100}%`, background: COLOURS.sage }} />
                  </span>
                )}
                <span className="w-9 text-right text-[13px] tabular-nums" style={{ color: COLOURS.leafSoft }}>
                  {child.stub ? '' : child.games}
                </span>
                <span className="flex w-14 shrink-0 items-center justify-end gap-1">
                  {below.priority !== undefined && <Target />}
                  {below.settle > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-extrabold text-white" style={{ background: COLOURS.terracotta }} title="Games to settle, on this move or further down">
                      {below.settle}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
        {children.length === 0 && (
          <li className="px-4 pb-3 text-[14px]" style={{ color: COLOURS.leafSoft }}>
            {mine ? 'Your repertoire stops here.' : 'No reply prepared yet.'}
          </li>
        )}
      </ul>
      <button type="button" onClick={onExtend} className="flex min-h-12 items-center gap-2 px-4 text-left text-[14px] font-bold focus-visible:outline-2" style={{ borderTop: `1px solid ${COLOURS.sand}`, color: REPERTOIRE }}>
        + {mine ? (children.length ? 'Add another move' : 'Add a move') : children.length ? 'Prepare another reply' : 'Prepare a reply'}
      </button>
    </section>
  );
}

/** Une priorité sur ce coup ou plus loin : une cible, comme la carte « Priority » qui l'explique. */
function Target() {
  return (
    <svg viewBox="0 0 20 20" className="size-[18px]" aria-label="Weak opening on this move or further down" role="img">
      <title>Weak opening on this move or further down</title>
      <circle cx="10" cy="10" r="8" fill="none" stroke={COLOURS.leaf} strokeWidth="2" />
      <circle cx="10" cy="10" r="4" fill="none" stroke={COLOURS.leaf} strokeWidth="2" />
      <circle cx="10" cy="10" r="1.3" fill={COLOURS.leaf} />
    </svg>
  );
}
