import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useAuthStore } from '../../../stores/authStore';
import { lichessSignInUrl } from '../line/explorer';
import { Kumquat } from './Kumquat';
import { useNoIndex, useV2Path, type V2Page } from './routes';
import { COLOURS, tile } from './theme';

// Deux lieux (README, « Path by use ») : ce qui attend le joueur, et son répertoire. Games et Openings restent
// joignables par leur adresse et depuis Today.
const PAGES: { page: V2Page; label: string }[] = [
  { page: 'today', label: 'Today' },
  { page: 'tree', label: 'Repertoire' },
];
// Le titre du menu au téléphone dit aussi les pages hors du menu.
const TITLES: Record<V2Page, string> = { today: 'Today', review: 'Review', tree: 'Repertoire', openings: 'Openings', games: 'Games' };

export function PageHeader({ children }: { children?: ReactNode }) {
  const pathOf = useV2Path();
  useNoIndex();
  return (
    <header className="mx-auto flex max-w-[84rem] items-center gap-x-2 gap-y-3 px-3 pt-3 sm:flex-wrap sm:gap-x-4 sm:px-8 sm:pt-7">
      <Kumquat />
      <span className="hidden text-[26px] font-bold tracking-[-0.03em] sm:inline">kumquat</span>
      <nav aria-label="Pages" className="hidden gap-1.5 text-[15px] font-semibold sm:ml-6 sm:flex">
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
      <span className="hidden text-[13px] font-semibold sm:inline">
        <Account />
      </span>
      <PageMenu />
      {children && <div className="ml-auto min-w-0 sm:w-auto">{children}</div>}
    </header>
  );
}

/** Au téléphone, les pages tiennent dans un menu : la place va à l'échiquier. */
function PageMenu() {
  const pathOf = useV2Path();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const press = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', press);
    return () => window.removeEventListener('keydown', press);
  }, [open]);
  const current = TITLES[(Object.keys(TITLES) as V2Page[]).find((page) => pathOf(page) === pathname) ?? 'today'];
  return (
    <div className="relative sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-full py-1.5 pl-0.5 pr-1 text-[17px] font-extrabold tracking-[-0.02em] focus-visible:outline-2"
      >
        {current}
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close the menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <nav aria-label="Pages" className="absolute left-0 top-full z-50 mt-1 flex w-44 flex-col overflow-hidden rounded-2xl py-1 text-[16px] font-semibold" style={{ background: COLOURS.paper, boxShadow: '0 14px 28px -10px oklch(0.3 0.06 150 / 0.45)' }}>
            {PAGES.map((page) => (
              <NavLink
                key={page.page}
                to={pathOf(page.page)}
                onClick={() => setOpen(false)}
                className="px-4 py-3 focus-visible:outline-2"
                style={({ isActive }) => (isActive ? { background: COLOURS.sand, color: COLOURS.leaf } : { color: COLOURS.leaf })}
              >
                {page.label}
              </NavLink>
            ))}
            <span className="mt-1 border-t px-4 pb-2 pt-3 text-[14px]" style={{ borderColor: COLOURS.sand }}>
              <Account />
            </span>
          </nav>
        </>
      )}
    </div>
  );
}

/** Le compte Lichess sert à l'explorateur : sans lui, seules les positions déjà en cache ont leurs statistiques. */
function Account() {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const logout = useAuthStore((state) => state.logout);
  if (loading) return null;
  if (!user) {
    return (
      <a href={lichessSignInUrl()} className="underline underline-offset-2 focus-visible:outline-2" style={{ color: COLOURS.leaf }}>
        Sign in with Lichess
      </a>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-x-2" style={{ color: COLOURS.leafSoft }}>
      {user.lichessUsername ?? user.username}
      <button type="button" onClick={logout} className="underline underline-offset-2 focus-visible:outline-2" style={{ color: COLOURS.leaf }}>
        Sign out
      </button>
    </span>
  );
}
