import { figurineLine } from '../domain/notation';
import { TaskDone } from '../workshop/Task';
import { COLOURS } from '../workshop/theme';

/** La fin de Check : ce qui a été réglé, remis à plus tard, ou est revenu, et ce qui reste à trancher. */
export function CheckSummary({ started, settled, skipped, returned, left }: { started: boolean; settled: number; skipped: number; returned: number; left: number }) {
  return (
    <TaskDone title={started ? (settled ? `${settled} settled` : 'Nothing settled') : 'Nothing to settle'}>
      {skipped > 0 && <p>{skipped} skipped for later</p>}
      {returned > 0 && <p>{returned} {returned === 1 ? 'game' : 'games'} left the repertoire again further on</p>}
      <p>{left ? `${left} still to settle, marked in your repertoire.` : 'Come back after your next games.'}</p>
    </TaskDone>
  );
}

/** La fin d'une ouverture faible préparée, avant de passer à la suivante. */
export function PreparedSummary({ moves, line, onNext }: { moves: number; line: readonly string[]; onNext?: () => void }) {
  return (
    <TaskDone title={`${moves} ${moves === 1 ? 'move' : 'moves'} added`} next={onNext && { label: 'Next weak opening', onClick: onNext }}>
      {line.length > 0 && <p style={{ color: COLOURS.leaf }}>{figurineLine(line)}</p>}
      <p>Your next games through this line will tell if the work pays.</p>
    </TaskDone>
  );
}
