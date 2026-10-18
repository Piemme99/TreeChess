// PROTOTYPE — barre de bascule jetable, volontairement hors charte.
import { useEffect } from 'react';

interface PrototypeSwitcherProps {
  variants: { key: string; name: string }[];
  current: string;
  onChange: (key: string) => void;
}

export function PrototypeSwitcher({ variants, current, onChange }: PrototypeSwitcherProps) {
  const index = Math.max(0, variants.findIndex((variant) => variant.key === current));
  const step = (delta: number) => onChange(variants[(index + delta + variants.length) % variants.length].key);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.key === 'ArrowLeft') step(-1);
      if (event.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border-2 border-fuchsia-400 bg-black px-2 py-1.5 font-sans text-white shadow-2xl">
      <button type="button" onClick={() => step(-1)} className="rounded-full px-2 hover:bg-white/15" aria-label="Previous variant">
        ←
      </button>
      <span className="whitespace-nowrap px-2 text-xs font-semibold tracking-wide">
        {variants[index].key} — {variants[index].name}
      </span>
      <button type="button" onClick={() => step(1)} className="rounded-full px-2 hover:bg-white/15" aria-label="Next variant">
        →
      </button>
    </div>
  );
}
