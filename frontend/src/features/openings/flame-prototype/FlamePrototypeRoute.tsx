// PROTOTYPE — quatre rendus du flame graph dans la vraie page Openings, bascule par ?flame=.
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { PrototypeSwitcher } from '../design-prototype/PrototypeSwitcher';
import { FlameTiles } from '../flame/FlameTiles';
import { OpeningsPage, type FlameSlotProps } from '../OpeningsPage';
import { HeatFlame } from './HeatFlame';
import { PlayerRowsFlame } from './PlayerRowsFlame';
import { PrunedFlame } from './PrunedFlame';

const VARIANTS = [
  { key: '0', name: 'Current tiles' },
  { key: 'K', name: 'Pruned · all proposals' },
  { key: 'L', name: 'Player rows only' },
  { key: 'M', name: 'Heat map' },
];

const RENDERERS: Record<string, (props: FlameSlotProps) => ReactNode> = {
  '0': ({ tree, focusPath, onFocusChange, onPoint }) => (
    <FlameTiles key={tree.side} tree={tree} focusPath={focusPath} onFocusChange={onFocusChange} onPoint={onPoint} />
  ),
  K: (props) => <PrunedFlame {...props} />,
  L: (props) => <PlayerRowsFlame {...props} />,
  M: (props) => <HeatFlame {...props} />,
};

export function FlamePrototypeRoute({ variant }: { variant: string }) {
  const [, setSearchParams] = useSearchParams();
  const current = variant in RENDERERS ? variant : '0';
  return (
    <>
      <OpeningsPage renderFlame={RENDERERS[current]} maxPlies={24} />
      <PrototypeSwitcher variants={VARIANTS} current={current} onChange={(key) => setSearchParams({ flame: key }, { replace: true })} />
    </>
  );
}
