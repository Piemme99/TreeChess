import { motion } from 'framer-motion';
import { useMemo, type ReactNode } from 'react';
import { draftLines } from '../domain/addition';
import { MATE_CP } from '../domain/diagnosis';
import { figurineMove } from '../domain/notation';
import { formatPercent } from '../flame/format';
import { JUDGEMENT_MARK, judgeMove } from '../domain/judgement';
import { useEvaluations } from '../line/engine';
import { LEVEL_LABEL } from '../line/explorer';
import { replayLine } from '../position/replay';
import { COLOURS, raised, SPRING, tile, TONES } from '../workshop/theme';
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
  const { checked, start, path, draft } = builder;
  const { check } = checked;
  const played = figurineMove(check.played, check.ply + 1);
  const lines = draftLines(draft);
  const toAdd = draft.length;

  return (
    <section aria-label="Addition" className="flex flex-col gap-4 rounded-3xl p-5" style={raised(false)}>
      <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">
        {check.kind === 'left' ? `You played ${played}: what do you want to play here?` : `Prepare your answer to ${played}`}
      </h2>
      <p className="text-[14px]" style={{ color: COLOURS.leafSoft }}>
        <EngineHere builder={builder} candidates={candidates} />
        {path.length > start.length && <span className="font-semibold"> · {formatFrom(start.length, path.slice(start.length))}</span>}
      </p>

      <CandidateTable builder={builder} candidates={candidates} onPoint={onPoint} />
      <Feedback builder={builder} />

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

function EngineHere({ builder, candidates }: { builder: Builder; candidates: Candidates }) {
  const { here } = candidates;
  if (!here) return <>Engine: looking at the position…</>;
  const ply = builder.path.length + 1;
  return (
    <>
      Engine here: <b style={{ color: COLOURS.leaf }}>{formatCp(here.cp)}</b>
      {builder.playerToMove && here.san && (
        <>
          {' '}· it would play <b style={{ color: COLOURS.kumquatDeep }}>{figurineMove(here.san, ply)}</b>, the orange arrow
        </>
      )}
    </>
  );
}

function CandidateTable({ builder, candidates, onPoint }: { builder: Builder; candidates: Candidates; onPoint: (san: string | null) => void }) {
  const { rows, explorer } = candidates;
  const ply = builder.path.length + 1;
  const side = builder.checked.game.side === 'w' ? 'White' : 'Black';
  const caption = builder.playerToMove
    ? 'Your move · the arrows on the board: click where one lands, or its row, to play it · any other move: click the piece, then its square'
    : 'Their move · pick a reply to prepare, on the board or below · any other move: click the piece, then its square';
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        {caption}
      </span>
      {explorer === 'missing' && <Muted>Needs a Lichess token (VITE_LICHESS_TOKEN in frontend/.env.local).</Muted>}
      {explorer === 'asking' && <Muted>Asking the Lichess explorer…</Muted>}
      {rows.length > 0 && (
        <table aria-label="Candidate moves" className="w-full border-collapse text-[14px]" onMouseLeave={() => onPoint(null)}>
          <thead className="text-[11px] font-semibold" style={{ color: COLOURS.leafSoft }}>
            <tr>
              <th />
              <th colSpan={2} className="px-2 pb-0.5 text-center font-semibold" style={{ borderBottom: `1px solid ${COLOURS.sand}` }}>
                At your level · {LEVEL_LABEL}
              </th>
              <th />
              <th />
            </tr>
            <tr className="text-left">
              <th className="pb-1 pr-2 font-semibold">Move</th>
              <th className="pb-1 px-2 font-semibold">played</th>
              <th className="pb-1 px-2 text-right font-semibold">score for {side}</th>
              <th className="pb-1 px-2 text-right font-semibold">Engine</th>
              <th className="pb-1 pl-2 text-right font-semibold">{builder.playerToMove ? 'Your games' : 'Met in your games'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <CandidateRow key={row.san} row={row} ply={ply} onPlay={() => builder.play(row.san)} onPoint={() => onPoint(row.san)} />
            ))}
          </tbody>
        </table>
      )}
      {candidates.costly.length > 0 && (
        <Muted>
          Not suggested, the engine says they cost points:{' '}
          {candidates.costly.map((row, index) => (
            <span key={row.san}>
              {index > 0 && ' · '}
              <b style={{ color: COLOURS.leaf }}>{figurineMove(row.san, ply)}</b>
              <b style={{ color: COLOURS.terracotta }}>{row.judgement && JUDGEMENT_MARK[row.judgement]}</b>
              {row.share !== undefined && ` ${formatPercent(row.share)} played`}
              {row.mine > 0 && ` · ${row.mine} of your games`}
            </span>
          ))}
          . You can still play one on the board and keep it.
        </Muted>
      )}
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        <Swatch colour={TONES.winning.bg}>in your games</Swatch>
        {builder.playerToMove && <Swatch colour={COLOURS.kumquatDeep}>engine move</Swatch>}
        <span>
          <b style={{ color: COLOURS.terracotta }}>?!</b> costs 5% of win chances · <b style={{ color: COLOURS.terracotta }}>?</b> 10% ·{' '}
          <b style={{ color: COLOURS.terracotta }}>??</b> 15%
        </span>
      </p>
    </div>
  );
}

function CandidateRow({ row, ply, onPlay, onPoint }: { row: Candidate; ply: number; onPlay: () => void; onPoint: () => void }) {
  const low = row.score !== undefined && row.score < 0.5;
  return (
    <tr
      className="cursor-pointer hover:bg-[oklch(0.975_0.012_85)]"
      style={{ borderTop: `1px solid ${COLOURS.sand}` }}
      onMouseEnter={onPoint}
      onClick={onPlay}
      onKeyDown={(event) => event.key === 'Enter' && onPlay()}
      tabIndex={0}
      aria-label={`Play ${row.san}`}
    >
      <td className="whitespace-nowrap py-1.5 pr-2 text-[15px] font-extrabold">
        {figurineMove(row.san, ply)}
        {row.engine && (
          <span className="ml-1.5 rounded-full px-1.5 text-[11px] font-extrabold align-[1px]" style={{ background: COLOURS.kumquatDeep, color: 'white' }}>
            engine
          </span>
        )}
      </td>
      <td className="px-2 py-1.5">
        <ShareBar share={row.share} mine={row.mine > 0} />
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right font-bold" style={{ color: low ? COLOURS.terracotta : undefined }}>
        {row.score === undefined ? '—' : formatPercent(row.score)}
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
        {row.cp === undefined ? <span style={{ color: COLOURS.leafSoft }}>…</span> : formatCp(row.cp)}
        {row.judgement && (
          <b className="ml-1" style={{ color: COLOURS.terracotta }}>
            {JUDGEMENT_MARK[row.judgement]}
          </b>
        )}
      </td>
      <td className="whitespace-nowrap py-1.5 pl-2 text-right" style={{ color: COLOURS.leafSoft }}>
        {row.mine > 0 ? row.mine : '—'}
      </td>
    </tr>
  );
}

function ShareBar({ share, mine }: { share: number | undefined; mine: boolean }) {
  return (
    <div className="relative h-4 min-w-[6rem] rounded-md" style={{ background: 'oklch(0.955 0.02 85)' }}>
      {share !== undefined && (
        <div
          className="h-full rounded-md"
          style={{ width: `${Math.max(share * 100, 2)}%`, background: mine ? TONES.winning.bg : COLOURS.sand, boxShadow: 'inset 0 -1.5px 0 oklch(0 0 0 / 0.1)' }}
        />
      )}
      <span className="absolute left-1.5 top-0 text-[11px] font-bold leading-4">{share === undefined ? 'not at your level' : formatPercent(share)}</span>
    </div>
  );
}

function Swatch({ colour, children }: { colour: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-3 rounded" style={{ background: colour }} />
      {children}
    </span>
  );
}

/** L'avis du moteur sur le dernier coup du joueur, une fois joué : utile pour un coup joué hors du tableau. */
function Feedback({ builder }: { builder: Builder }) {
  const { path, start, checked } = builder;
  const last = path.length - 1;
  const mover = last % 2 === 0 ? 'w' : 'b';
  const relevant = path.length > start.length && mover === checked.game.side;
  const fens = useMemo(() => (relevant ? replayLine(path).fens.slice(-2) : []), [relevant, path]);
  const evaluations = useEvaluations(fens, ENGINE_DEPTH, relevant);
  if (!relevant) return null;
  const [before, after] = fens.map((fen) => evaluations.get(fen));
  const move = figurineMove(path[last], last + 1);
  if (!before || !after) return <Muted>Engine: looking at {move}…</Muted>;
  const judgement = judgeMove(before.cp, after.cp, mover);
  return (
    <p className="text-[14px] font-semibold" style={{ color: judgement ? COLOURS.terracotta : COLOURS.leafSoft }}>
      Engine: {move}
      {judgement ? `${JUDGEMENT_MARK[judgement]} · ${judgement}. Go back and try another move, or keep it.` : ' holds.'}
    </p>
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
