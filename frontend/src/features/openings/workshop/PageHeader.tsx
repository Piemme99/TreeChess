import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, useSearchParams } from 'react-router';
import { authApi } from '../../../services/api';
import { useAuthStore } from '../../../stores/authStore';
import { getApiErrorStatus } from '../../../shared/utils/apiError';
import { lichessSignInUrl } from '../services/explorer';
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
  // Lichess renvoie ici (?deletion=failed) une suppression qu'il n'a pas confirmée : le menu se rouvre pour le dire.
  const [params, setParams] = useSearchParams();
  const deletionFailed = params.get('deletion') === 'failed';
  const [open, setOpen] = useState(deletionFailed);
  const [deleting, setDeleting] = useState(deletionFailed);
  const user = useAuthStore((state) => state.user);
  const shown = open && (!deleting || user !== null);
  useEffect(() => {
    if (!open) return;
    const press = (event: KeyboardEvent) => event.key === 'Escape' && close();
    window.addEventListener('keydown', press);
    return () => window.removeEventListener('keydown', press);
  });
  const close = () => {
    setOpen(false);
    setDeleting(false);
    if (deletionFailed) setParams((current) => (current.delete('deletion'), current), { replace: true });
  };
  return (
    <div className="relative sm:ml-auto">
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={shown}
        aria-haspopup="true"
        onClick={() => (open ? close() : setOpen(true))}
        className="grid size-10 place-items-center rounded-full text-[20px] font-extrabold leading-none focus-visible:outline-2"
        style={shown ? { background: COLOURS.sand } : undefined}
      >
        ⋯
      </button>
      {shown && (
        <>
          <button type="button" aria-label="Close the menu" className="fixed inset-0 z-40 cursor-default" onClick={close} />
          <div className="absolute right-0 top-full z-50 mt-1 flex w-72 flex-col divide-y divide-[oklch(0.915_0.035_80)] overflow-hidden rounded-2xl py-1 text-[15px]" style={{ background: COLOURS.paper, color: COLOURS.leaf, boxShadow: '0 14px 28px -10px oklch(0.3 0.06 150 / 0.45)' }}>
            {deleting ? <DeleteAccount failed={deletionFailed} onCancel={close} /> : <Account onDelete={() => setDeleting(true)} />}
            {/* Le tableau des ouvertures ne tient pas dans un téléphone. */}
            {!deleting && wide && (
              <Link to={pathOf('openings')} onClick={() => setOpen(false)} className="px-4 py-3 font-semibold focus-visible:outline-2">
                All your openings by result →
              </Link>
            )}
            {/* Le jour suivant se voit sur la page : le menu se referme pour la laisser voir. */}
            {/* Les parties importées ne se rejouent pas : le rejeu n'existe que dans la démo. */}
            {!deleting && replay && (replay.next || replay.reset) && (
              <ReplayPanel replay={{ ...replay, next: replay.next && (() => (replay.next!(), setOpen(false))), reset: replay.reset && (() => (replay.reset!(), setOpen(false))) }} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Le compte Lichess sert à l'explorateur : sans lui, seules les positions déjà en cache ont leurs statistiques. */
function Account({ onDelete }: { onDelete: () => void }) {
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
      <button type="button" onClick={onDelete} className="ml-auto text-[13px] underline underline-offset-2 focus-visible:outline-2" style={{ color: COLOURS.terracotta }}>
        Delete account
      </button>
    </span>
  );
}

/** Supprimer le compte efface ses parties et ses décisions : un compte Lichess le confirme sur Lichess (#241). */
function DeleteAccount({ failed, onCancel }: { failed: boolean; onCancel: () => void }) {
  const user = useAuthStore((state) => state.user);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState(failed ? 'Lichess did not confirm it with this account: nothing was deleted.' : '');
  const [sending, setSending] = useState(false);
  if (!user) return null;
  const viaLichess = user.oauthProvider === 'lichess';
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      const { redirect } = await authApi.startAccountDeletion(typed);
      window.location.assign(redirect ?? '/v2/home?deleted=1');
    } catch (err) {
      setSending(false);
      setError(getApiErrorStatus(err) === 400 ? 'That is not your username.' : 'The deletion did not go through: nothing was deleted.');
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 px-4 py-3" style={{ color: COLOURS.leafSoft }}>
      <strong className="text-[16px]" style={{ color: COLOURS.leaf }}>Delete your account?</strong>
      <p>Your imported games and your repertoire are erased for good.{viaLichess && ' Lichess asks you to confirm.'}</p>
      <label className="flex flex-col gap-1 font-semibold">
        Type {user.username} to confirm
        <input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} className="rounded-lg border px-2 py-1.5 font-normal" style={{ borderColor: COLOURS.sand, color: COLOURS.leaf }} />
      </label>
      {error && (
        <p role="alert" className="font-semibold" style={{ color: COLOURS.terracotta }}>
          {error}
        </p>
      )}
      <span className="flex items-center gap-3">
        <button type="submit" disabled={typed !== user.username || sending} className="rounded-full px-4 py-2 font-bold disabled:opacity-40 focus-visible:outline-2" style={{ background: COLOURS.terracotta, color: COLOURS.cream }}>
          {viaLichess ? 'Delete with Lichess' : 'Delete'}
        </button>
        <button type="button" onClick={onCancel} className="font-semibold underline underline-offset-2 focus-visible:outline-2" style={{ color: COLOURS.leaf }}>
          Cancel
        </button>
      </span>
    </form>
  );
}
