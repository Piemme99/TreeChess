import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { Kumquat } from './Kumquat';
import { COLOURS, tile } from './theme';

const PAGES = [
  { to: '/dev/flame-graph', label: 'Openings' },
  { to: '/dev/games', label: 'Games' },
];

export function PageHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="mx-auto flex max-w-[84rem] flex-wrap items-center gap-x-4 gap-y-3 px-8 pt-7">
      <Kumquat />
      <span className="text-[26px] font-bold tracking-[-0.03em]">kumquat</span>
      <nav aria-label="Pages" className="ml-6 flex gap-1.5 text-[15px] font-semibold">
        {PAGES.map((page) => (
          <NavLink
            key={page.to}
            to={page.to}
            className="rounded-full px-3.5 py-1.5"
            style={({ isActive }) => (isActive ? { background: COLOURS.leaf, color: COLOURS.cream } : { ...tile(COLOURS.sand), color: COLOURS.leaf })}
          >
            {page.label}
          </NavLink>
        ))}
      </nav>
      {children}
    </header>
  );
}
