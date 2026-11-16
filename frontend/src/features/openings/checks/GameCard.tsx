import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { JUDGEMENT_MARK, type Judgement } from '../domain/judgement';
import { figurineMove } from '../domain/notation';
import { replayLine } from '../position/replay';
import { formatDay } from '../replay/formatDay';
import { COLOURS, raised, SPRING, TONES } from '../workshop/theme';
import { checkedPath, type CheckedGame } from './checkedGame';

const VERDICT = {
  left: { label: 'Left the repertoire', tone: TONES.losing },
  uncovered: { label: 'Not covered yet', tone: TONES.slipping },
  followed: { label: 'Followed', tone: TONES.winning },
};

const RESULT = { 1: 'Won', 0.5: 'Draw', 0: 'Lost' } as const;

interface GameCardProps {
  checked: CheckedGame;
  selected: boolean;
  onSelect: () => void;
  showDate?: boolean;
  onIgnore?: () => void;
  onAdd?: () => void;
  ignored?: boolean;
  /** Pour un coup adverse hors répertoire : `undefined` tant que le moteur cherche. */
  judgement?: Judgement | null;
}

export function GameCard({ checked, selected, onSelect, showDate = false, onIgnore, onAdd, ignored = false, judgement }: GameCardProps) {
  const { game, check } = checked;
  const fens = useMemo(() => replayLine(game.moves.slice(0, Math.max(1, checkedPath(checked).length + 1))).fens, [checked, game.moves]);
  const opening = useOpeningName(fens);
  const verdict = VERDICT[check.kind];

  return (
    <li className="flex flex-col overflow-hidden rounded-2xl" style={{ ...raised(selected), opacity: ignored ? 0.7 : 1 }}>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="flex min-w-0 cursor-pointer flex-col gap-1 px-4 pt-3 pb-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <span className="flex items-center gap-2 text-[12px] font-semibold">
          <span className="rounded-full px-2 py-0.5" style={{ background: verdict.tone.bg, color: verdict.tone.fg }}>
            {verdict.label}
          </span>
          <span style={{ opacity: 0.7 }}>
            {game.side === 'w' ? 'White' : 'Black'} · {RESULT[game.score]}
            {showDate && ` · ${formatDay(game.playedAt)}`}
          </span>
        </span>
        <span className="truncate text-[16px] font-semibold">{opening?.name ?? 'Unnamed opening'}</span>
        <span className="text-[14px]" style={{ opacity: 0.8 }}>
          <Verdict checked={checked} judgement={judgement} />
        </span>
      </button>
      {ignored && (
        <span className="px-4 pb-3 text-[13px] font-semibold" style={{ opacity: 0.75 }}>
          Set aside
        </span>
      )}
      {(onAdd || onIgnore) && (
      <span className="flex flex-wrap items-center gap-2 px-4 pb-3">
      {onAdd && (
        <motion.button
          type="button"
          onClick={onAdd}
          aria-label={`${check.kind === 'uncovered' ? 'Prepare an answer' : 'Add the move played'}: ${opening?.name ?? 'this game'}`}
          whileHover={{ y: -2, scale: 1.05 }}
          whileTap={{ scale: 0.94 }}
          transition={SPRING}
          className="cursor-pointer self-center whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-bold transition-shadow hover:shadow-[0_6px_14px_-6px_oklch(0.3_0.06_150/0.6)] focus-visible:outline-2"
          style={selected ? { background: COLOURS.cream, color: COLOURS.leaf } : { background: COLOURS.leaf, color: COLOURS.cream }}
        >
          {check.kind === 'left' ? `Add ${figurineMove(check.played, check.ply + 1)}` : 'Prepare an answer'}
        </motion.button>
      )}
      {onIgnore && (
        <motion.button
          type="button"
          onClick={onIgnore}
          aria-label={`${check.kind === 'uncovered' ? 'Not worth preparing' : 'Stay on my repertoire'}: ${opening?.name ?? 'this game'}`}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.94 }}
          transition={SPRING}
          className="cursor-pointer self-center whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-semibold underline-offset-4 hover:underline focus-visible:outline-2"
          style={{ color: selected ? COLOURS.cream : COLOURS.leafSoft }}
        >
          {check.kind !== 'left' ? 'Not worth preparing' : check.planned.length === 1 ? `Stay on ${figurineMove(check.planned[0], check.ply + 1)}` : 'Stay on my repertoire'}
        </motion.button>
      )}
      </span>
      )}
    </li>
  );
}

function Verdict({ checked: { check }, judgement }: { checked: CheckedGame; judgement?: Judgement | null }) {
  if (check.kind === 'followed') {
    const moves = Math.ceil(check.plies / 2);
    return <>Your repertoire held for {moves} {moves === 1 ? 'move' : 'moves'}</>;
  }
  const played = figurineMove(check.played, check.ply + 1);
  if (check.kind === 'left') {
    const planned = check.planned.map((san) => figurineMove(san, check.ply + 1)).join(' · ');
    return (
      <>
        You played <b>{played}</b>, your repertoire has {planned}
      </>
    );
  }
  return (
    <>
      Opponent played{' '}
      <b>
        {played}
        {judgement && JUDGEMENT_MARK[judgement]}
      </b>
      {judgement && (
        <span className="font-semibold" style={{ color: judgement === 'inaccuracy' ? COLOURS.kumquatDeep : COLOURS.terracotta }}>
          {' '}
          · {judgement}
        </span>
      )}
    </>
  );
}
