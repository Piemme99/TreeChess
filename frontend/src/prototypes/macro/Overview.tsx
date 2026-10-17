// PROTOTYPE — rendu de la synthèse. Jetable.
import type { Chantier } from './chantiers';

interface Props {
  items: Chantier[];
  onOpen: (item: Chantier) => void;
}

export function Overview({ items, onOpen }: Props) {
  if (items.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">À travailler en priorité</h2>
      <p className="mt-0.5 text-xs text-slate-600">
        les deux couleurs confondues, classées par ce qu’il y a à y gagner
      </p>
      <div className="mt-3 space-y-2">
        {items.slice(0, 5).map((item, rank) => (
          <button
            key={item.nodeId + item.entry}
            onClick={() => onOpen(item)}
            className="flex w-full items-start gap-4 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-left hover:border-slate-600"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 font-mono text-xs text-slate-400">
              {rank + 1}
            </span>
            <span className="flex-1">
              <span className="flex items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">
                  {item.color === 'white' ? 'blancs' : 'noirs'}
                </span>
                {!item.confident && (
                  <span className="text-[10px] uppercase tracking-wider text-slate-600">à confirmer</span>
                )}
              </span>
              <span className="mt-0.5 block font-mono text-sm text-slate-100">{item.headline}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{item.detail}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-mono text-lg text-amber-400">{item.points.toFixed(1)}</span>
              <span className="block text-[10px] uppercase tracking-wider text-slate-600">points en jeu</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
