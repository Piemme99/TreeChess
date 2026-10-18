// PROTOTYPE — quatre dispositions de la vue de ligne dans la vraie page Openings, bascule par ?line=.
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { PrototypeSwitcher } from '../design-prototype/PrototypeSwitcher';
import { LineView } from '../line/LineView';
import { OpeningsPage, type LineSlotProps } from '../OpeningsPage';
import { DiagnosisLine } from './DiagnosisLine';
import { ForkMapLine } from './ForkMapLine';
import { MomentsLine } from './MomentsLine';
import { ProfileLine } from './ProfileLine';

const VARIANTS = [
  { key: '0', name: 'Current' },
  { key: 'A', name: 'Profile' },
  { key: 'B', name: 'Fork map' },
  { key: 'C', name: 'Moments' },
  { key: 'D', name: 'Engine vs you' },
];

const key = (props: LineSlotProps) => `${props.tree.side}:${props.path.join(' ')}`;

const RENDERERS: Record<string, (props: LineSlotProps) => ReactNode> = {
  '0': (props) => <LineView key={key(props)} {...props} />,
  A: (props) => <ProfileLine key={key(props)} {...props} />,
  B: (props) => <ForkMapLine key={key(props)} {...props} />,
  C: (props) => <MomentsLine key={key(props)} {...props} />,
  D: (props) => <DiagnosisLine key={key(props)} {...props} />,
};

export function LinePrototypeRoute({ variant }: { variant: string }) {
  const [, setSearchParams] = useSearchParams();
  const current = variant in RENDERERS ? variant : '0';
  return (
    <>
      <OpeningsPage renderLine={RENDERERS[current]} studyFirstPriority />
      <PrototypeSwitcher
        variants={VARIANTS}
        current={current}
        keys={['[', ']']}
        onChange={(next) => setSearchParams({ line: next }, { replace: true })}
      />
    </>
  );
}
