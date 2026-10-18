import type { ReactNode } from 'react';
import { COLOURS, tile } from './theme';

export function Chip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex flex-col items-center rounded-xl px-3 py-1.5" style={tile(COLOURS.sand)}>
      <span className="text-[18px] leading-tight font-bold">{children}</span>
      <span className="text-[11px] font-medium" style={{ color: COLOURS.leafSoft }}>
        {label}
      </span>
    </span>
  );
}
