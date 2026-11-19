import { COLOURS } from './theme';

/** Sous le pouce, comme la barre de Lichess : début, coup précédent, coup suivant, fin de ligne. */
export function BottomBar({ onStart, onBack, onForward, onEnd }: { onStart?: () => void; onBack?: () => void; onForward?: () => void; onEnd?: () => void }) {
  const buttons = [
    { label: 'Start', onClick: onStart, icon: 'M7 6v12M18 6l-8 6 8 6z' },
    { label: 'Previous move', onClick: onBack, icon: 'M16 6l-8 6 8 6z' },
    { label: 'Next move', onClick: onForward, icon: 'M8 6l8 6-8 6z' },
    { label: 'End of the line', onClick: onEnd, icon: 'M17 6v12M6 6l8 6-8 6z' },
  ];
  return (
    <nav aria-label="Move navigation" className="fixed inset-x-0 bottom-0 z-30 flex pb-[env(safe-area-inset-bottom)]" style={{ background: COLOURS.leaf }}>
      {buttons.map((button) => (
        <button
          key={button.label}
          type="button"
          aria-label={button.label}
          onClick={button.onClick}
          disabled={!button.onClick}
          className="grid h-14 flex-1 place-items-center focus-visible:outline-2 focus-visible:-outline-offset-4 active:bg-white/10 disabled:opacity-35"
          style={{ color: COLOURS.cream }}
        >
          <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" aria-hidden="true">
            <path d={button.icon} />
          </svg>
        </button>
      ))}
    </nav>
  );
}
