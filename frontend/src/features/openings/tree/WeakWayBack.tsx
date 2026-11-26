import { COLOURS } from '../workshop/theme';

/** Dans la tâche, loin de sa ligne : y revenir ou passer à la suivante sans fermer. */
export function WeakWayBack({ rank, onBack, onNext, what = 'weak opening' }: { rank: number; onBack: () => void; onNext?: () => void; what?: string }) {
  return (
    <nav aria-label={what[0].toUpperCase() + what.slice(1)} className="sticky top-14 z-20 flex items-center justify-between gap-3 px-1 text-[14px] font-bold sm:px-6" style={{ background: COLOURS.sand, color: COLOURS.leaf }}>
      <button type="button" onClick={onBack} className="min-h-11 rounded-lg px-3 focus-visible:outline-2">
        ← Back to {what} {rank}
      </button>
      {onNext && (
        <button type="button" onClick={onNext} className="min-h-11 rounded-lg px-3 focus-visible:outline-2">
          Next {what} →
        </button>
      )}
    </nav>
  );
}
