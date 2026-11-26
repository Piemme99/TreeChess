import { COVERAGE_GOAL } from '../domain/gaps';
import { figurineLine } from '../domain/notation';
import type { GapScan } from '../gaps/useGaps';
import { lichessSignInUrl, useExplorerSignIn } from '../services/explorer';
import { TaskDone } from '../workshop/Task';
import { COLOURS, tile } from '../workshop/theme';

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

/** Un trou comblé, avant de passer au suivant. */
export function GapSummary({ moves, line, onNext }: { moves: number; line: readonly string[]; onNext?: () => void }) {
  return (
    <TaskDone title={`${moves} ${moves === 1 ? 'move' : 'moves'} added`} next={onNext && { label: 'Next gap', onClick: onNext }}>
      {line.length > 0 && <p style={{ color: COLOURS.leaf }}>{figurineLine(line)}</p>}
      <p>One gap fewer in your repertoire.</p>
    </TaskDone>
  );
}

/** Avant le premier trou : la recherche en cours, un répertoire sans trou, ou un explorateur muet. */
export function GapsLooking({ scan }: { scan: GapScan }) {
  const signIn = useExplorerSignIn();
  if (scan.done && !scan.gaps.length) {
    return (
      <TaskDone title="No gap">
        <p>Every move that reaches 1 game in {Math.round(1 / COVERAGE_GOAL)} at your level has an answer in your repertoire.</p>
      </TaskDone>
    );
  }
  if (scan.unavailable) {
    return (
      <section className="mx-auto mt-6 flex max-w-[30rem] flex-col gap-3 rounded-3xl px-5 py-6 text-[15px]" style={{ background: COLOURS.paper }}>
        <p>The Lichess explorer did not answer: the gaps need what players at your level play.</p>
        {signIn && (
          <a href={lichessSignInUrl()} className="grid min-h-12 place-items-center rounded-full px-5 font-bold focus-visible:outline-2" style={{ ...tile(COLOURS.sand), color: COLOURS.leaf }}>
            Sign in with Lichess
          </a>
        )}
      </section>
    );
  }
  return (
    <p role="status" className="mx-auto mt-6 max-w-[30rem] px-1 text-[15px]" style={{ color: COLOURS.leafSoft }}>
      Looking at what players at your level play against your repertoire… {scan.read > 0 && `${scan.read} ${scan.read === 1 ? 'position' : 'positions'} read.`}
    </p>
  );
}
