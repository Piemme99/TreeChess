// PROTOTYPE JETABLE — trois variantes de la boucle repérer → comprendre → préparer → vérifier,
// sur une seule ligne (Scandinave), commutables via ?variant= et ?step=. Aucun backend, données figées.
import { useSearchParams } from 'react-router';
import { PrototypeSwitcher } from './PrototypeSwitcher';
import { VariantA, name as nameA } from './VariantA';
import { VariantB, name as nameB } from './VariantB';
import { VariantC, name as nameC } from './VariantC';

const VARIANTS = [
  { key: 'A', name: nameA },
  { key: 'B', name: nameB },
  { key: 'C', name: nameC },
];

export function LoopPrototypePage() {
  const [params, setParams] = useSearchParams();
  const variant = params.get('variant') ?? 'A';
  const step = Number(params.get('step') ?? 1);

  const set = (next: Partial<{ variant: string; step: number }>) => {
    const p = new URLSearchParams(params);
    if (next.variant !== undefined) p.set('variant', next.variant);
    if (next.step !== undefined) p.set('step', String(next.step));
    setParams(p, { replace: true });
  };

  const onStep = (n: number) => set({ step: n });

  return (
    <>
      {variant === 'A' && <VariantA step={step} onStep={onStep} />}
      {variant === 'B' && <VariantB step={step} onStep={onStep} />}
      {variant === 'C' && <VariantC step={step} onStep={onStep} />}
      <PrototypeSwitcher
        variants={VARIANTS}
        current={variant}
        step={step}
        onVariant={(key) => set({ variant: key, step: 1 })}
        onStep={onStep}
      />
    </>
  );
}
