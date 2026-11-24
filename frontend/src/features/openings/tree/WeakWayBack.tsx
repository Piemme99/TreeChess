import { COLOURS } from '../workshop/theme';

/** Dans la tâche, loin de la ligne faible : y revenir ou passer à la suivante sans fermer. */
export function WeakWayBack({ rank, onBack, onNext }: { rank: number; onBack: () => void; onNext?: () => void }) {
  return (
    <nav aria-label="Weak opening" className="sticky top-14 z-20 flex items-center justify-between gap-3 px-1 text-[14px] font-bold sm:px-6" style={{ background: COLOURS.sand, color: COLOURS.leaf }}>
      <button type="button" onClick={onBack} className="min-h-11 rounded-lg px-3 focus-visible:outline-2">
        ← Back to weak opening {rank}
      </button>
      {onNext && (
        <button type="button" onClick={onNext} className="min-h-11 rounded-lg px-3 focus-visible:outline-2">
          Next weak opening →
        </button>
      )}
    </nav>
  );
}
