import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { figurineMove } from '../domain/notation';
import { replayLine } from '../position/replay';
import { formatDay } from '../replay/formatDay';
import { COLOURS, raised, SPRING, TONES } from '../workshop/theme';
import { checkedPath, type CheckedGame } from './checkedGame';

const VERDICT = {
  left: { label: 'Left the repertoire', tone: TONES.losing },
  uncovered: { label: 'Not covered', tone: TONES.slipping },
  followed: { label: 'Followed', tone: TONES.winning },
};

const RESULT = { 1: 'Won', 0.5: 'Draw', 0: 'Lost' } as const;

interface GameCardProps {
  checked: CheckedGame;
  selected: boolean;
  onSelect: () => void;
  showDate?: boolean;
  onIgnore?: () => void;
  ignored?: boolean;
}

export function GameCard({ checked, selected, onSelect, showDate = false, onIgnore, ignored = false }: GameCardProps) {
  const { game, check } = checked;
  const fens = useMemo(() => replayLine(game.moves.slice(0, Math.max(1, checkedPath(checked).length + 1))).fens, [checked, game.moves]);
  const opening = useOpeningName(fens);
  const verdict = VERDICT[check.kind];

  return (
    <li className="flex items-stretch gap-2" style={{ opacity: ignored ? 0.5 : 1 }}>
      <motion.button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        whileHover={{ y: -2 }}
        transition={SPRING}
        className="flex min-w-0 flex-1 flex-col gap-1 rounded-2xl px-4 py-3 text-left"
        style={raised(selected)}
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
          <Verdict checked={checked} />
        </span>
      </motion.button>
      {ignored && (
        <span className="self-center px-3 text-[13px] font-semibold" style={{ color: COLOURS.leafSoft }}>
          Ignored
        </span>
      )}
      {onIgnore && (
        <button
          type="button"
          onClick={onIgnore}
          aria-label={`Ignore ${opening?.name ?? 'this game'}`}
          className="self-center rounded-full px-3 py-1.5 text-[13px] font-semibold"
          style={{ color: COLOURS.leafSoft }}
        >
          Ignore
        </button>
      )}
    </li>
  );
}

function Verdict({ checked: { check } }: { checked: CheckedGame }) {
  if (check.kind === 'followed') return <>Your repertoire held for {Math.ceil(check.plies / 2)} moves</>;
  const played = figurineMove(check.played, check.ply + 1);
  const planned = check.planned.map((san) => figurineMove(san, check.ply + 1)).join(' · ');
  return check.kind === 'left' ? (
    <>
      You played <b>{played}</b>, your repertoire has {planned}
    </>
  ) : (
    <>
      Opponent played <b>{played}</b>, your repertoire answers {planned}
    </>
  );
}
