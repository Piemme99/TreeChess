import { isPlayerMove } from '../domain/openingTree';
import { figurineMove } from '../domain/notation';
import type { Side } from '../domain/playedGame';
import type { Removal } from '../domain/removal';
import { positionKey } from '../domain/repertoire';
import type { StoppedMove } from '../domain/stopped';
import { replayLine } from '../position/replay';
import type { useReplayedSession } from '../session/useReplayedSession';
import type { ToastMessage } from '../workshop/useToast';
import type { StoppedActions } from './PositionPane';
import { findByPosition, startsWith, type MapNode } from './repertoireMap';
import type { TreeWalk } from './useTreeWalk';

type Replayed = ReturnType<typeof useReplayedSession>;

/** Retirer un coup du répertoire : à la main sous un coup du joueur, ou sur la carte « No longer played ». */
export function useRemovals({
  walk,
  maps,
  today,
  stopped,
  keep,
  unkeep,
  removeMove,
  restoreMove,
  show,
  toTop,
}: Pick<Replayed, 'stopped' | 'keep' | 'unkeep' | 'removeMove' | 'restoreMove'> & {
  walk: TreeWalk;
  maps: Record<Side, MapNode>;
  today: string;
  show: (message: ToastMessage) => void;
  toTop: () => void;
}) {
  const { side, path, node } = walk;
  const removeLast = () => {
    const last = path[path.length - 1];
    const before = path.slice(0, -1);
    // Le vrai jour, pas celui de la dernière partie importée : les parties jouées depuis l'ont été avec le coup.
    const removal: Removal = { side, position: positionKey(replayLine(path).fens[before.length]), san: last, removedAt: today };
    removeMove(removal);
    walk.walk(before);
    toTop();
    show({
      text: `${figurineMove(last, path.length)} and what follows removed from your repertoire`,
      undo: () => {
        restoreMove(removal);
        walk.walk(path);
      },
    });
  };
  const inRepertoire = path.length === node.path.length;
  const stoppedHere = inRepertoire ? stopped.filter((move) => move.side === side && move.position === node.position) : [];
  const stoppedElsewhere = stopped.filter((move) => !stoppedHere.includes(move));
  // Après un retrait, les coups délaissés plus loin sur la même ligne partent avec lui.
  const toNextStopped = (removed?: readonly string[]) => {
    const next = stoppedElsewhere.find((move) => !removed || !startsWith(move.path, removed));
    const target = next && findByPosition(maps[next.side], next.position);
    if (target) walk.goTo(next.side, target.key, true);
  };
  // Comme une séance : une décision prise, on passe au coup suivant que le joueur ne joue plus.
  const stoppedActions: StoppedActions = {
    moves: stoppedHere,
    others: stoppedElsewhere.length,
    onRemove: (move: StoppedMove) => {
      const removal: Removal = { side: move.side, position: move.position, san: move.san, removedAt: today };
      removeMove(removal);
      toNextStopped([...move.path, move.san]);
      toTop();
      show({ text: `${figurineMove(move.san, node.path.length + 1)} and what follows removed from your repertoire`, undo: () => restoreMove(removal) });
    },
    onKeep: (move: StoppedMove) => {
      const kept = keep(move, today);
      toNextStopped();
      toTop();
      show({ text: `${figurineMove(move.san, node.path.length + 1)} kept · back in your review`, undo: () => unkeep(kept) });
    },
    onNext: stoppedElsewhere.length ? () => toNextStopped() : undefined,
  };
  // Seuls les coups du joueur se retirent : ceux de l'adversaire, il les subit.
  const onRemove = path.length && path.length === node.path.length && isPlayerMove(side, path.length) ? removeLast : undefined;

  return { stoppedActions, onRemove };
}
