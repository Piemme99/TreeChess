// Workshop, la direction retenue, est devenue l'écran Openings. Les autres directions restent
// consultables via ?variant=, pour référence (voir NOTES.md).
import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { OpeningsPage } from '../OpeningsPage';
import { ClubhouseVariant } from './ClubhouseVariant';
import { ClubVariant } from './ClubVariant';
import { PrototypeSwitcher } from './PrototypeSwitcher';
import { useOpeningsScreen } from './useOpeningsScreen';
import { WorkshopWoodVariant } from './WorkshopWoodVariant';

const VARIANTS = [
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
  const [searchParams, setSearchParams] = useSearchParams();
  const variant = searchParams.get('variant');
  if (!variant || variant === 'C') return <OpeningsPage />;
  return <Variant variant={variant} onChange={(key) => setSearchParams(key === 'C' ? {} : { variant: key }, { replace: true })} />;
}

function Variant({ variant, onChange }: { variant: string; onChange: (key: string) => void }) {
  useVariantFonts();
  const screen = useOpeningsScreen();

  return (
    <>
      {variant === 'F' && <ClubVariant screen={screen} />}
      {variant === 'G' && <ClubhouseVariant screen={screen} surface="wood" />}
      {variant === 'H' && <ClubhouseVariant screen={screen} surface="baize" />}
      {variant === 'I' && <ClubhouseVariant screen={screen} surface="cream" />}
      {variant === 'J' && <WorkshopWoodVariant screen={screen} />}
      <PrototypeSwitcher variants={VARIANTS} current={variant} onChange={onChange} />
    </>
  );
}
