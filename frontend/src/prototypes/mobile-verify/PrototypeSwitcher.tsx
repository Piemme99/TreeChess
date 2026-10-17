// PROTOTYPE — barre de navigation jetable, volontairement hors charte.
import { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SCENARIOS, type ScenarioKey } from './checks';

interface Props {
  variants: { key: string; name: string }[];
  current: string;
  scenario: ScenarioKey;
  onVariant: (key: string) => void;
  onScenario: (key: ScenarioKey) => void;
}

export function PrototypeSwitcher({ variants, current, scenario, onVariant, onScenario }: Props) {
  const index = Math.max(0, variants.findIndex((v) => v.key === current));
  const previous = variants[(index - 1 + variants.length) % variants.length].key;
  const following = variants[(index + 1) % variants.length].key;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target;
      if (el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'ArrowLeft') onVariant(previous);
      if (e.key === 'ArrowRight') onVariant(following);
      const pick = SCENARIOS[Number(e.key) - 1];
      if (pick) onScenario(pick.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previous, following, onVariant, onScenario]);

  return (
    <div className="fixed bottom-3 left-1/2 z-50 flex max-w-[98vw] -translate-x-1/2 overflow-x-auto items-center gap-1 rounded-full border border-white/20 bg-black/90 px-2 py-1.5 text-white shadow-2xl backdrop-blur">
      <button onClick={() => onVariant(previous)} className="rounded-full p-1.5 hover:bg-white/15" aria-label="Previous variant">
        <ChevronLeft size={16} />
      </button>
      <span className="whitespace-nowrap px-2 text-xs font-semibold tracking-wide">
        {current} — {variants[index]?.name}
      </span>
      <button onClick={() => onVariant(following)} className="rounded-full p-1.5 hover:bg-white/15" aria-label="Next variant">
        <ChevronRight size={16} />
      </button>
      <span className="mx-1 h-5 w-px bg-white/20" />
      {SCENARIOS.map((s, i) => (
        <button
          key={s.key}
          onClick={() => onScenario(s.key)}
          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
            scenario === s.key ? 'bg-white text-black' : 'text-white/60 hover:bg-white/15'
          }`}
        >
          {i + 1}. {s.label}
        </button>
      ))}
    </div>
  );
}
