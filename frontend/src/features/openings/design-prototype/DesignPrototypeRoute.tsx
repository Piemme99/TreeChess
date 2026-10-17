// PROTOTYPE — directions esthétiques pour l'écran Openings, sur la route /dev/flame-graph,
// basculables via ?variant=. « 0 » est l'écran actuel ; C (Workshop) est la direction retenue, voir NOTES.md.
// Question : quelle direction donne à la v2 son identité ?
import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { FlameGraphPage } from '../FlameGraphPage';
import { ClubhouseVariant } from './ClubhouseVariant';
import { ClubVariant } from './ClubVariant';
import { PrototypeSwitcher } from './PrototypeSwitcher';
import { useOpeningsScreen } from './useOpeningsScreen';
import { WorkshopVariant } from './WorkshopVariant';
import { WorkshopWoodVariant } from './WorkshopWoodVariant';

const VARIANTS = [
  { key: '0', name: 'Current' },
  { key: 'C', name: 'Workshop (chosen)' },
  { key: 'F', name: 'Club' },
  { key: 'G', name: 'Clubhouse · wood table' },
  { key: 'H', name: 'Clubhouse · baize' },
  { key: 'I', name: 'Clubhouse · cream' },
  { key: 'J', name: 'Workshop · wood' },
];

const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=Noto+Sans+Symbols+2&family=Gloock&family=Hanken+Grotesk:wght@300..800&family=Chivo+Mono:wght@400..700&display=swap';

function useVariantFonts() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTS_URL;
    document.head.appendChild(link);
    return () => link.remove();
  }, []);
}

export function DesignPrototypeRoute() {
  useVariantFonts();
  const [searchParams, setSearchParams] = useSearchParams();
  const variant = searchParams.get('variant') ?? 'C';
  const screen = useOpeningsScreen();

  return (
    <>
      {variant === '0' && <FlameGraphPage />}
      {variant === 'C' && <WorkshopVariant screen={screen} />}
      {variant === 'F' && <ClubVariant screen={screen} />}
      {variant === 'G' && <ClubhouseVariant screen={screen} surface="wood" />}
      {variant === 'H' && <ClubhouseVariant screen={screen} surface="baize" />}
      {variant === 'I' && <ClubhouseVariant screen={screen} surface="cream" />}
      {variant === 'J' && <WorkshopWoodVariant screen={screen} />}
      <PrototypeSwitcher variants={VARIANTS} current={variant} onChange={(key) => setSearchParams({ variant: key }, { replace: true })} />
    </>
  );
}
