import { motion } from 'framer-motion';
import { useMemo, type ReactNode } from 'react';
import { draftLines } from '../domain/addition';
import { MATE_CP, winChance } from '../domain/diagnosis';
import { figurineMove } from '../domain/notation';
import { formatPercent } from '../flame/format';
import { JUDGEMENT_MARK, judgeMove, type Judgement } from '../domain/judgement';
import { useEvaluations } from '../line/engine';
import { replayLine } from '../position/replay';
import { COLOURS, raised, SPRING, tile } from '../workshop/theme';
import type { Builder } from './useBuilder';
import { ENGINE_DEPTH, type Candidate, type Candidates } from './useCandidates';

interface BuildPanelProps {
  builder: Builder;
  candidates: Candidates;
  onPoint: (san: string | null) => void;
  onAccept: () => void;
  onCancel: () => void;
}

export function BuildPanel({ builder, candidates, onPoint, onAccept, onCancel }: BuildPanelProps) {
  const { checked, draft } = builder;
  const { check } = checked;
  const played = figurineMove(check.played, check.ply + 1);
  const lines = draftLines(draft);
  const toAdd = draft.length;

  return (
    <section aria-label="Addition" className="flex flex-col gap-4 rounded-3xl p-5" style={raised(false)}>
      <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">
        {check.kind === 'left' ? `You played ${played}: what do you want to play here?` : `Prepare your answer to ${played}`}
      </h2>

      <Played builder={builder} />
      <CandidateTable builder={builder} candidates={candidates} onPoint={onPoint} />

      {lines.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold" style={{ color: COLOURS.leafSoft }}>
            To add
          </span>
          <ul aria-label="To add" className="flex flex-col gap-0.5 text-[14px] font-semibold">
            {lines.map((line) => (
              <li key={line.join(' ')}>{formatFrom(check.ply, line.slice(check.ply))}</li>
            ))}
          </ul>
        </div>
      )}

      <span className="flex flex-wrap gap-2">
        {builder.complete && (
          <Action onClick={onAccept} primary>
            Add to my repertoire · {toAdd} {toAdd === 1 ? 'move' : 'moves'}
          </Action>
        )}
        {builder.back && <Action onClick={builder.back}>← Back</Action>}
        {builder.undo && <Action onClick={builder.undo}>Undo last move</Action>}
        <Action onClick={onCancel}>Cancel</Action>
      </span>
    </section>
  );
}

/** Les coups joués depuis le départ, le dernier du joueur marqué si le moteur le juge. */
function Played({ builder }: { builder: Builder }) {
  const { path, start, checked } = builder;
  const last = path.length - 1;
  const mover = last % 2 === 0 ? 'w' : 'b';
  const relevant = path.length > start.length && mover === checked.game.side;
  const fens = useMemo(() => (relevant ? replayLine(path).fens.slice(-2) : []), [relevant, path]);
  const evaluations = useEvaluations(fens, ENGINE_DEPTH, relevant);
  if (path.length === start.length) return null;
  const [before, after] = fens.map((fen) => evaluations.get(fen));
  const judgement = relevant && before && after ? judgeMove(before.cp, after.cp, mover) : null;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold">
      {path.slice(start.length).map((san, index) => {
        const ply = start.length + index + 1;
        const byPlayer = (ply % 2 === 1) === (checked.game.side === 'w');
        const marked = ply === path.length ? judgement : null;
        return (
          <span key={ply} className="rounded-lg px-2 py-0.5" style={byPlayer ? tile(COLOURS.sand) : { background: COLOURS.opponent }}>
            {figurineMove(san, ply)}
            {marked && <Mark judgement={marked} />}
          </span>
        );
      })}
    </p>
  );
}

function CandidateTable({ builder, candidates, onPoint }: { builder: Builder; candidates: Candidates; onPoint: (san: string | null) => void }) {
  const { rows, costly, here, explorer } = candidates;
  const ply = builder.path.length + 1;
  const side = builder.checked.game.side === 'w' ? 'White' : 'Black';
  const all = [...rows, ...costly];
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-3 text-[12px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        {builder.playerToMove ? 'Your move' : 'Their move'}
        <EvalBar cp={here?.cp} />
      </span>
      {explorer === 'missing' && <Muted>Needs a Lichess token (VITE_LICHESS_TOKEN in frontend/.env.local).</Muted>}
      {explorer === 'asking' && <Muted>Asking the Lichess explorer…</Muted>}
      {all.length > 0 && (
        <table aria-label="Candidate moves" className="w-full border-collapse text-[14px]" onMouseLeave={() => onPoint(null)}>
          <thead className="text-[11px] font-semibold" style={{ color: COLOURS.leafSoft }}>
            <tr>
              <th />
              <th colSpan={2} className="px-2 pb-0.5 text-center font-semibold" style={{ borderBottom: `1px solid ${COLOURS.sand}` }}>
                Lichess 1400–1800
              </th>
              <th />
              <th />
            </tr>
            <tr className="text-left">
              <th className="pb-1 pr-2 font-semibold">Move</th>
              <th className="pb-1 px-2 font-semibold">played</th>
              <th className="pb-1 px-2 text-right font-semibold">{side} scores</th>
              <th className="pb-1 px-2 text-right font-semibold">Engine</th>
              <th className="pb-1 pl-2 text-right font-semibold">{builder.playerToMove ? 'Your games' : 'Met'}</th>
            </tr>
          </thead>
          <tbody>
            {all.map((row) => (
              <CandidateRow
                key={row.san}
                row={row}
                ply={ply}
                faded={costly.includes(row)}
                onPlay={() => builder.play(row.san)}
                onPoint={() => onPoint(row.san)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CandidateRow({ row, ply, faded, onPlay, onPoint }: { row: Candidate; ply: number; faded: boolean; onPlay: () => void; onPoint: () => void }) {
  const low = row.score !== undefined && Math.round(row.score * 100) < 50;
  return (
    <tr
      className="cursor-pointer hover:bg-[oklch(0.975_0.012_85)]"
      style={{ borderTop: `1px solid ${COLOURS.sand}`, opacity: faded ? 0.45 : 1 }}
      onMouseEnter={onPoint}
      onClick={onPlay}
      onKeyDown={(event) => event.key === 'Enter' && onPlay()}
      tabIndex={0}
      aria-label={`Play ${row.san}`}
    >
      <td className="whitespace-nowrap py-1.5 pr-2 text-[15px] font-extrabold">
        {figurineMove(row.san, ply)}
        {row.judgement && <Mark judgement={row.judgement} />}
        {row.engine && (
          <span className="ml-1.5 rounded-full px-1.5 text-[11px] font-extrabold align-[1px]" style={{ background: COLOURS.kumquatDeep, color: 'white' }}>
            engine
          </span>
        )}
      </td>
      <td className="px-2 py-1.5">
        <ShareBar share={row.share} />
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right font-bold" style={{ color: low ? COLOURS.terracotta : undefined }}>
        {row.score === undefined ? '—' : formatPercent(row.score)}
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
        {row.cp === undefined ? <span style={{ color: COLOURS.leafSoft }}>…</span> : formatCp(row.cp)}
      </td>
      <td className="whitespace-nowrap py-1.5 pl-2 text-right" style={{ color: COLOURS.leafSoft }}>
        {row.mine > 0 ? row.mine : '—'}
      </td>
    </tr>
  );
}

function Mark({ judgement }: { judgement: Judgement }) {
  return (
    <b className="ml-0.5" title={judgement} style={{ color: COLOURS.terracotta }}>
      {JUDGEMENT_MARK[judgement]}
    </b>
  );
}

function ShareBar({ share }: { share: number | undefined }) {
  return (
    <div className="relative h-4 min-w-[6rem] rounded-md" style={{ background: 'oklch(0.955 0.02 85)' }}>
      {share !== undefined && (
        <div
          className="h-full rounded-md"
          style={{ width: `${Math.max(share * 100, 2)}%`, background: COLOURS.sand, boxShadow: 'inset 0 -1.5px 0 oklch(0 0 0 / 0.1)' }}
        />
      )}
      <span className="absolute left-1.5 top-0 text-[11px] font-bold leading-4">{share === undefined ? '—' : formatPercent(share)}</span>
    </div>
  );
}

/** La position vue par le moteur, comme la barre de Lichess : la part blanche est la chance des Blancs. */
function EvalBar({ cp }: { cp: number | undefined }) {
  const white = cp === undefined ? 0.5 : winChance(cp);
  return (
    <span className="flex items-center gap-1.5" title={cp === undefined ? 'Engine: looking…' : `Engine: ${formatCp(cp)}`}>
      <span className="relative h-2.5 w-20 overflow-hidden rounded-full" style={{ background: COLOURS.leaf }}>
        <motion.span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: COLOURS.cream }}
          animate={{ width: `${white * 100}%` }}
          transition={SPRING}
        />
      </span>
      <span className="tabular-nums">{cp === undefined ? '…' : formatCp(cp)}</span>
    </span>
  );
}

/** Centipions des Blancs, comme sur Lichess : « −0.5 », « +1.2 », « #». */
function formatCp(cp: number): string {
  if (Math.abs(cp) >= MATE_CP) return cp > 0 ? '#' : '−#';
  const pawns = (Math.abs(cp) / 100).toFixed(1);
  return cp < 0 ? `−${pawns}` : cp > 0 ? `+${pawns}` : '0.0';
}

const formatFrom = (offset: number, moves: readonly string[]) =>
  moves.map((san, index) => figurineMove(san, offset + index + 1)).join(' ');

function Muted({ children }: { children: ReactNode }) {
  return (
    <p className="text-[13px]" style={{ color: COLOURS.leafSoft }}>
      {children}
    </p>
  );
}

function Action({ onClick, primary = false, children }: { onClick: () => void; primary?: boolean; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.96 }}
      transition={SPRING}
      className="cursor-pointer whitespace-nowrap rounded-full px-4 py-1.5 text-[14px] font-bold"
      style={primary ? { background: COLOURS.leaf, color: COLOURS.cream } : { ...tile(COLOURS.sand), color: COLOURS.leaf }}
    >
      {children}
    </motion.button>
  );
}
