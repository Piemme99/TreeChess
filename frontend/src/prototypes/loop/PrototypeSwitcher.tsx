// PROTOTYPE — barre de navigation jetable, volontairement hors charte.
import { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { STEPS } from './data';

interface Props {
  variants: { key: string; name: string }[];
  current: string;
  step: number;
  onVariant: (key: string) => void;
  onStep: (n: number) => void;
}

export function PrototypeSwitcher({ variants, current, step, onVariant, onStep }: Props) {
  const index = Math.max(0, variants.findIndex((v) => v.key === current));

  useEffect(() => {
    const isTyping = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === 'ArrowLeft') onVariant(variants[(index - 1 + variants.length) % variants.length].key);
      if (e.key === 'ArrowRight') onVariant(variants[(index + 1) % variants.length].key);
      if (['1', '2', '3', '4'].includes(e.key)) onStep(Number(e.key));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, variants, onVariant, onStep]);

  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 flex items-center gap-1 rounded-full border border-white/20 bg-black/90 px-2 py-1.5 text-white shadow-2xl backdrop-blur">
      <button
        onClick={() => onVariant(variants[(index - 1 + variants.length) % variants.length].key)}
        className="rounded-full p-1.5 hover:bg-white/15"
        aria-label="Variante précédente"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="px-2 text-xs font-semibold tracking-wide whitespace-nowrap">
        {current} — {variants[index]?.name}
      </span>
      <button
        onClick={() => onVariant(variants[(index + 1) % variants.length].key)}
        className="rounded-full p-1.5 hover:bg-white/15"
        aria-label="Variante suivante"
      >
        <ChevronRight size={16} />
      </button>
      <span className="mx-1 h-5 w-px bg-white/20" />
      {STEPS.map((s) => (
        <button
          key={s.n}
          onClick={() => onStep(s.n)}
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
            step === s.n ? 'bg-white text-black' : 'text-white/60 hover:bg-white/15'
          }`}
        >
          {s.n}. {s.label}
        </button>
      ))}
    </div>
  );
}
