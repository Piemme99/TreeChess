import { motion } from 'framer-motion';
import { useMemo, type ReactNode } from 'react';
import { draftLines } from '../domain/addition';
import { figurineMove } from '../domain/notation';
import { formatPercent } from '../flame/format';
import { JUDGEMENT_MARK, judgeMove } from '../domain/judgement';
import { useEvaluations } from '../line/engine';
import { hasExplorer } from '../line/explorer';
import { replayLine } from '../position/replay';
import { COLOURS, raised, SPRING, tile } from '../workshop/theme';
import type { Builder } from './useBuilder';
import { useExplorerAt } from './useExplorerAt';

const FEEDBACK_DEPTH = 14;
const MAX_CANDIDATES = 6;
// Une réponse adverse plus rare que ça à ton niveau ne vaut pas une pastille ; on peut toujours la jouer.
const MIN_REPLY_SHARE = 0.05;

interface BuildPanelProps {
  builder: Builder;
  hint: boolean;
  onHint: () => void;
  onAccept: () => void;
  onCancel: () => void;
}

export function BuildPanel({ builder, hint, onHint, onAccept, onCancel }: BuildPanelProps) {
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
        Play the moves on the board. They go into your repertoire when you add them.
        {path.length > start.length && <span className="font-semibold"> · {formatFrom(start.length, path.slice(start.length))}</span>}
      </p>

      {builder.playerToMove ? <YourMove builder={builder} hint={hint} onHint={onHint} /> : <TheirMove builder={builder} />}
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
        {toAdd > 0 && (
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

function YourMove({ builder, hint, onHint }: { builder: Builder; hint: boolean; onHint: () => void }) {
  const explorer = useExplorerAt(builder.fen);
  const side = builder.checked.game.side;
  const ply = builder.path.length + 1;
  const candidates = (explorer?.moves ?? []).slice(0, MAX_CANDIDATES);
  const total = explorer ? explorer.white + explorer.draws + explorer.black : 0;
  const yours = [...builder.mine.keys()].filter((san) => !candidates.some((move) => move.san === san));

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        Your move · what players of your level play here
      </span>
      {!hasExplorer() && <Muted>Needs a Lichess token (VITE_LICHESS_TOKEN in frontend/.env.local).</Muted>}
      {explorer === undefined && <Muted>Asking the Lichess explorer…</Muted>}
      <div className="flex flex-wrap gap-1.5">
        {candidates.map((move) => {
          const games = move.white + move.draws + move.black;
          const wins = side === 'w' ? move.white : move.black;
          return (
            <Chip key={move.san} onClick={() => builder.play(move.san)} label={`Play ${move.san}`}>
              <b>{figurineMove(move.san, ply)}</b> {formatPercent(games / total)} played · {formatPercent((wins + move.draws / 2) / games)} scored
              {builder.mine.has(move.san) && ` · ${builder.mine.get(move.san)} of yours`}
            </Chip>
          );
        })}
        {yours.map((san) => (
          <Chip key={san} onClick={() => builder.play(san)} label={`Play ${san}`}>
            <b>{figurineMove(san, ply)}</b> {builder.mine.get(san)} of yours
          </Chip>
        ))}
      </div>
      <span>
        <Action onClick={onHint}>{hint ? 'Hide the hint' : 'Hint: show the engine move'}</Action>
      </span>
    </div>
  );
}

function TheirMove({ builder }: { builder: Builder }) {
  const explorer = useExplorerAt(builder.fen);
  const ply = builder.path.length + 1;
  const total = explorer ? explorer.white + explorer.draws + explorer.black : 0;
  const replies = (explorer?.moves ?? []).filter((move) => (move.white + move.draws + move.black) / total >= MIN_REPLY_SHARE);
  const met = [...builder.mine.keys()].filter((san) => !replies.some((move) => move.san === san));

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-semibold" style={{ color: COLOURS.leafSoft }}>
        Their move · pick a reply to prepare, or play any move on the board
      </span>
      {explorer === undefined && <Muted>Asking the Lichess explorer…</Muted>}
      <div className="flex flex-wrap gap-1.5">
        {replies.map((move) => (
          <Chip key={move.san} onClick={() => builder.play(move.san)} label={`Play ${move.san}`} opponent>
            <b>{figurineMove(move.san, ply)}</b> {formatPercent((move.white + move.draws + move.black) / total)}
            {builder.mine.has(move.san) && ` · met ${builder.mine.get(move.san)}×`}
          </Chip>
        ))}
        {met.map((san) => (
          <Chip key={san} onClick={() => builder.play(san)} label={`Play ${san}`} opponent>
            <b>{figurineMove(san, ply)}</b> met {builder.mine.get(san)}×
          </Chip>
        ))}
      </div>
    </div>
  );
}

/** L'avis du moteur sur le dernier coup du joueur, une fois joué : jamais avant. */
function Feedback({ builder }: { builder: Builder }) {
  const { path, start, checked } = builder;
  const last = path.length - 1;
  const mover = last % 2 === 0 ? 'w' : 'b';
  const relevant = path.length > start.length && mover === checked.game.side;
  const fens = useMemo(() => (relevant ? replayLine(path).fens.slice(-2) : []), [relevant, path]);
  const evaluations = useEvaluations(fens, FEEDBACK_DEPTH, relevant);
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

const formatFrom = (offset: number, moves: readonly string[]) =>
  moves.map((san, index) => figurineMove(san, offset + index + 1)).join(' ');

function Muted({ children }: { children: ReactNode }) {
  return (
    <p className="text-[13px]" style={{ color: COLOURS.leafSoft }}>
      {children}
    </p>
  );
}

function Chip({ onClick, label, opponent = false, children }: { onClick: () => void; label: string; opponent?: boolean; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.95 }}
      transition={SPRING}
      className="cursor-pointer rounded-lg px-2.5 py-1 text-[13px]"
      style={opponent ? { background: COLOURS.opponent } : tile(COLOURS.sand)}
    >
      {children}
    </motion.button>
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
