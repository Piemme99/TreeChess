import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router';
import { useAuthStore } from '../../../stores/authStore';
import { lichessSignInUrl } from '../line/explorer';
import { ReplayPanel } from '../replay/ReplayPanel';
import type { ReplayDay } from '../replay/useReplayDay';
import { Kumquat } from './Kumquat';
import { useNoIndex, useV2Path, type V2Page } from './routes';
import { COLOURS } from './theme';
import { useWide } from './useWide';

// Deux lieux (docs/flow/target.html) : ce qui attend le joueur, et son répertoire. Les tâches partent de Home.
const PAGES: { page: V2Page; label: string }[] = [
  { page: 'home', label: 'Home' },
  { page: 'tree', label: 'Repertoire' },
];

/** `wide` : la page s'étend sur un grand écran (Repertoire), l'en-tête la suit. */
export function PageHeader({ replay, wide = false }: { replay?: ReplayDay; wide?: boolean }) {
  const pathOf = useV2Path();
  useNoIndex();
  return (
    <header className={`mx-auto flex max-w-[84rem] ${wide ? 'min-[100rem]:max-w-[160rem]' : ''} items-center gap-2 px-3 pt-3 sm:gap-4 sm:px-8 sm:pt-6`}>
      <Kumquat />
      <span className="hidden text-[26px] font-bold tracking-[-0.03em] sm:inline">kumquat</span>
      <nav aria-label="Pages" className="ml-auto flex gap-1 text-[15px] font-semibold sm:ml-6">
        {PAGES.map((page) => (
          <NavLink
            key={page.page}
            to={pathOf(page.page)}
            className="rounded-full px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 sm:px-3.5 sm:py-2"
            style={({ isActive }) => (isActive ? { background: COLOURS.leaf, color: COLOURS.cream } : { color: COLOURS.leaf })}
          >
            {page.label}
          </NavLink>
        ))}
      </nav>
      <Menu replay={replay} />
    </header>
  );
}

/** Ce qui ne sert pas tous les jours : le compte Lichess, la vue des ouvertures à l'ordinateur, le rejeu. */
function Menu({ replay }: { replay?: ReplayDay }) {
  const pathOf = useV2Path();
  const wide = useWide();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const press = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', press);
    return () => window.removeEventListener('keydown', press);
  }, [open]);
  return (
    <div className="relative sm:ml-auto">
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
        className="grid size-10 place-items-center rounded-full text-[20px] font-extrabold leading-none focus-visible:outline-2"
        style={open ? { background: COLOURS.sand } : undefined}
      >
        ⋯
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close the menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 flex w-72 flex-col divide-y divide-[oklch(0.915_0.035_80)] overflow-hidden rounded-2xl py-1 text-[15px]" style={{ background: COLOURS.paper, color: COLOURS.leaf, boxShadow: '0 14px 28px -10px oklch(0.3 0.06 150 / 0.45)' }}>
            <Account />
            {/* Le tableau des ouvertures ne tient pas dans un téléphone. */}
            {wide && (
              <Link to={pathOf('openings')} onClick={() => setOpen(false)} className="px-4 py-3 font-semibold focus-visible:outline-2">
                All your openings by result →
              </Link>
            )}
            {/* Le jour suivant se voit sur la page : le menu se referme pour la laisser voir. */}
            {/* Les parties importées ne se rejouent pas : le rejeu n'existe que dans la démo. */}
            {replay && (replay.next || replay.reset) && (
              <ReplayPanel replay={{ ...replay, next: replay.next && (() => (replay.next!(), setOpen(false))), reset: replay.reset && (() => (replay.reset!(), setOpen(false))) }} />
            )}
          </div>
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
      <a href={lichessSignInUrl()} className="px-4 py-3 font-semibold underline underline-offset-2 focus-visible:outline-2" style={{ color: COLOURS.leaf }}>
        Sign in with Lichess
      </a>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-x-2 px-4 py-3 font-semibold" style={{ color: COLOURS.leafSoft }}>
      {user.lichessUsername ?? user.username}
      <button type="button" onClick={logout} className="underline underline-offset-2 focus-visible:outline-2" style={{ color: COLOURS.leaf }}>
        Sign out
      </button>
    </span>
  );
}
