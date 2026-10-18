import { motion } from 'framer-motion';
import { useMemo, useState, type ReactNode } from 'react';
import { additionMoves, type AddedMove } from '../domain/addition';
import type { GameCheck } from '../domain/gameCheck';
import { figurineMove } from '../domain/notation';
import type { PlayedGame } from '../domain/playedGame';
import { Preparation, type PointedPreparation } from '../line/Preparation';
import { usePreparation } from '../line/useLineDiagnosis';
import { COLOURS, raised, SPRING, tile } from '../workshop/theme';
import type { CheckedGame } from './checkedGame';

type Deviation = Extract<GameCheck, { kind: 'left' | 'uncovered' }>;

// Un écart peut tomber dès le premier coup : préparer 12 demi-coups demande des minutes à l'explorateur
// (une requête à la fois). L'ajout reste court ; le renforcer d'une priorité va plus loin.
const ADDITION_PLIES = 6;

interface AdditionPanelProps {
  checked: CheckedGame & { check: Deviation };
  /** Les parties du joueur avec ce côté, connues le jour du rejeu : ses habitudes. */
  games: readonly PlayedGame[];
  onPoint: (pointed: PointedPreparation | null) => void;
  onAccept: (moves: AddedMove[]) => void;
  onCancel: () => void;
}

export function AdditionPanel({ checked, games, onPoint, onAccept, onCancel }: AdditionPanelProps) {
  const { game, check } = checked;
  const path = useMemo(() => game.moves.slice(0, check.ply), [game.moves, check.ply]);
  const keyPath = useMemo(() => [...path, check.played], [path, check.played]);
  const preparation = usePreparation(keyPath, game.side, games, ADDITION_PLIES);
  const [cut, setCut] = useState<ReadonlySet<string>>(new Set());
  const toggle = (line: string) =>
    setCut((current) => {
      const next = new Set(current);
      if (!next.delete(line)) next.add(line);
      return next;
    });

  const played = figurineMove(check.played, check.ply + 1);
  const planned = check.planned.map((san) => figurineMove(san, check.ply + 1)).join(' · ');
  const accept = () => onAccept(additionMoves(path, { san: check.played, source: 'habit' }, preparation.done ? preparation.moves : [], cut));

  return (
    <section aria-label="Addition" className="flex flex-col gap-3 rounded-3xl p-5" style={raised(false)}>
      <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Add {played} to your repertoire</h2>
      <p className="text-[14px]" style={{ color: COLOURS.leafSoft }}>
        {check.kind === 'left'
          ? `It becomes one of your choices here, next to ${planned}. What follows is prepared from your games, then from what players of your level play.`
          : `Your repertoire gets an answer to it. What follows is prepared from your games, then from what players of your level play.`}{' '}
        Cut what you don't want to learn.
      </p>
      <Preparation
        preparation={preparation}
        keyPath={keyPath}
        onPoint={onPoint}
        cutting={{ cut, toggle }}
        // Les actions vivent sous le panneau : elles doivent rester là pendant le calcul et sans proposition.
        actions={<></>}
      />
      <span className="flex gap-2">
        {preparation.done && (
          <Action onClick={accept} primary>
            {preparation.moves.length ? 'Add to my repertoire' : `Add ${played} alone`}
          </Action>
        )}
        <Action onClick={onCancel}>Cancel</Action>
      </span>
    </section>
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
      className="whitespace-nowrap rounded-full px-4 py-1.5 text-[14px] font-bold"
      style={primary ? { background: COLOURS.leaf, color: COLOURS.cream } : { ...tile(COLOURS.sand), color: COLOURS.leaf }}
    >
      {children}
    </motion.button>
  );
}
