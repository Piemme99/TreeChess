import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../../services/api';
import { getApiErrorMessage } from '../../../shared/utils/apiError';
import { useV2Path } from '../workshop/routes';
import { COLOURS } from '../workshop/theme';
import type { ImportState } from './useGameSource';

/** Dans le menu : ajouter ses parties Chess.com à celles de Lichess, ou les retirer. */
export function ChesscomAccount() {
  const pathOf = useV2Path();
  // Home relit les parties au chargement et suit l'import lancé : on y retourne après un changement de compte.
  const backHome = () => window.location.assign(pathOf('home'));
  // undefined : pas encore lu ; '' : pas de compte Chess.com.
  const [linked, setLinked] = useState<string>();
  const [mode, setMode] = useState<'idle' | 'adding' | 'removing'>('idle');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => {
    api
      .get<ImportState>('/v2/games/import')
      .then(({ data }) => setLinked(data.chesscom ?? ''))
      .catch(() => setLinked(''));
  }, []);
  if (linked === undefined) return null;

  const send = async (request: () => Promise<unknown>) => {
    setSending(true);
    setError('');
    try {
      await request();
      backHome();
    } catch (err) {
      setSending(false);
      setError(getApiErrorMessage(err) ?? 'Chess.com could not be reached. Try again in a minute.');
    }
  };
  const add = (event: FormEvent) => {
    event.preventDefault();
    void send(() => api.put('/v2/games/chesscom', { username: typed.trim() }));
  };
  const cancel = () => {
    setMode('idle');
    setError('');
  };
  const alert = error && (
    <p role="alert" className="font-semibold" style={{ color: COLOURS.terracotta }}>
      {error}
    </p>
  );

  if (mode === 'adding') {
    return (
      <form onSubmit={add} className="flex flex-col gap-3 px-4 py-3" style={{ color: COLOURS.leafSoft }}>
        <label className="flex flex-col gap-1 font-semibold" style={{ color: COLOURS.leaf }}>
          Chess.com username
          <input value={typed} onChange={(event) => setTyped(event.target.value)} autoFocus autoComplete="off" autoCapitalize="none" spellCheck={false} className="rounded-lg border px-2 py-1.5 font-normal" style={{ borderColor: COLOURS.sand, color: COLOURS.leaf }} />
        </label>
        <p className="text-[13px]">Your blitz and rapid games there join your Lichess ones and your repertoire.</p>
        {alert}
        <span className="flex items-center gap-3">
          <button type="submit" disabled={!typed.trim() || sending} className="rounded-full px-4 py-2 font-bold disabled:opacity-40 focus-visible:outline-2" style={{ background: COLOURS.leaf, color: COLOURS.cream }}>
            {sending ? 'Importing…' : 'Import'}
          </button>
          <button type="button" onClick={cancel} className="font-semibold underline underline-offset-2 focus-visible:outline-2" style={{ color: COLOURS.leaf }}>
            Cancel
          </button>
        </span>
      </form>
    );
  }
  if (mode === 'removing') {
    return (
      <div className="flex flex-col gap-3 px-4 py-3" style={{ color: COLOURS.leafSoft }}>
        <strong className="text-[16px]" style={{ color: COLOURS.leaf }}>Remove your Chess.com games?</strong>
        <p>The games of {linked} leave Kumquat, with the repertoire moves that came only from them. Your Lichess games stay.</p>
        {alert}
        <span className="flex items-center gap-3">
          <button type="button" disabled={sending} onClick={() => void send(() => api.delete('/v2/games/chesscom'))} className="rounded-full px-4 py-2 font-bold disabled:opacity-40 focus-visible:outline-2" style={{ background: COLOURS.terracotta, color: COLOURS.cream }}>
            Remove
          </button>
          <button type="button" onClick={cancel} className="font-semibold underline underline-offset-2 focus-visible:outline-2" style={{ color: COLOURS.leaf }}>
            Cancel
          </button>
        </span>
      </div>
    );
  }
  if (linked) {
    return (
      <span className="flex flex-wrap items-center gap-x-2 px-4 py-3 font-semibold" style={{ color: COLOURS.leafSoft }}>
        Chess.com · {linked}
        <button type="button" onClick={() => setMode('removing')} className="ml-auto text-[13px] underline underline-offset-2 focus-visible:outline-2" style={{ color: COLOURS.terracotta }}>
          Remove
        </button>
      </span>
    );
  }
  return (
    <button type="button" onClick={() => setMode('adding')} className="px-4 py-3 text-left font-semibold focus-visible:outline-2" style={{ color: COLOURS.leaf }}>
      Add your Chess.com games
    </button>
  );
}
