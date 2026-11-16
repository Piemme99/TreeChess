import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { Kumquat } from './Kumquat';
import { useNoIndex, useV2Path, type V2Page } from './routes';
import { COLOURS, tile } from './theme';

// L'arbre est l'écran d'arrivée ; l'aiguillage (/dev/home) reste joignable par son adresse, hors du menu.
const PAGES: { page: V2Page; label: string }[] = [
  { page: 'tree', label: 'Tree' },
  { page: 'openings', label: 'Openings' },
  { page: 'games', label: 'Games' },
];

export function PageHeader({ children }: { children?: ReactNode }) {
  const pathOf = useV2Path();
  useNoIndex();
  return (
    <header className="mx-auto flex max-w-[84rem] flex-wrap items-center gap-x-4 gap-y-3 px-4 pt-5 sm:px-8 sm:pt-7">
      <Kumquat />
      <span className="hidden text-[26px] font-bold tracking-[-0.03em] sm:inline">kumquat</span>
      <nav aria-label="Pages" className="flex gap-1.5 text-[15px] font-semibold sm:ml-6">
        {PAGES.map((page) => (
          <NavLink
            key={page.page}
            to={pathOf(page.page)}
            className="rounded-full px-3.5 py-2 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={({ isActive }) => (isActive ? { background: COLOURS.leaf, color: COLOURS.cream } : { ...tile(COLOURS.sand), color: COLOURS.leaf })}
          >
            {page.label}
          </NavLink>
        ))}
      </nav>
      {children && <div className="w-full sm:ml-auto sm:w-auto">{children}</div>}
    </header>
  );
}
