// PROTOTYPE JETABLE — trois variantes de l'étape Vérifier sur téléphone (ADR 0002), commutables via
// ?variant= et ?scenario=, sur les vraies parties figées de Piemme78. Aucun backend.
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { playedGamesFixture } from '../../features/openings/fixtures/playedGames';
import { buildMobileData, SCENARIOS, type ScenarioKey } from './checks';
import { PhoneFrame } from './Phone';
import { PrototypeSwitcher } from './PrototypeSwitcher';
import { VariantA, name as nameA } from './VariantA';
import { VariantB, name as nameB } from './VariantB';
import { VariantC, name as nameC } from './VariantC';

const VARIANTS = [
  { key: 'A', name: nameA },
  { key: 'B', name: nameB },
  { key: 'C', name: nameC },
];

export function MobileVerifyPrototypePage() {
  const data = useMemo(() => buildMobileData(playedGamesFixture), []);
  const [params, setParams] = useSearchParams();
  const variant = params.get('variant') ?? 'A';
  const scenarioParam = params.get('scenario');
  const scenario = SCENARIOS.find((s) => s.key === scenarioParam)?.key ?? 'left';

  const set = (key: 'variant' | 'scenario', value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };

  const screenKey = `${variant}-${scenario}`;

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-200 pb-16">
      <PhoneFrame>
        {variant === 'A' && <VariantA key={screenKey} data={data} scenario={scenario} />}
        {variant === 'B' && <VariantB key={screenKey} data={data} scenario={scenario} />}
        {variant === 'C' && <VariantC key={screenKey} data={data} scenario={scenario} />}
      </PhoneFrame>
      <PrototypeSwitcher
        variants={VARIANTS}
        current={variant}
        scenario={scenario}
        onVariant={(key) => set('variant', key)}
        onScenario={(key: ScenarioKey) => set('scenario', key)}
      />
    </div>
  );
}
