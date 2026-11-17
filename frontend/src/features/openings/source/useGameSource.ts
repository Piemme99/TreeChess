import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { useAuthStore } from '../../../stores/authStore';
import { useImported } from '../home/useImported';
import { DEMO_SOURCE, importedSource, type GameSource, type ImportedGame } from './gameSource';

export interface ImportState {
  status: 'none' | 'running' | 'done' | 'failed';
  imported: number;
  error?: string;
  finishedAt?: string;
}

export type SourceState =
  | { kind: 'loading' }
  /** Ni compte Lichess ni démo : l'écran de connexion. */
  | { kind: 'signed-out' }
  /** Compte Lichess, pas encore d'import réussi : l'écran d'import, ou sa progression. */
  | { kind: 'to-import'; username: string; state: ImportState }
  | { kind: 'ready'; source: GameSource };

// Les parties ne changent pas d'une page à l'autre : on ne les relit qu'une fois par compte.
let cached: { userId: string; source: GameSource } | null = null;

/** La source des parties des pages v2, et ce qui manque pour l'avoir. */
export function useGameSource() {
  const user = useAuthStore((store) => store.user);
  const loading = useAuthStore((store) => store.loading);
  const [demo, setDemo] = useImported();
  const [state, setState] = useState<SourceState>(() =>
    cached && user?.id === cached.userId ? { kind: 'ready', source: cached.source } : { kind: 'loading' },
  );
  const linked = Boolean(user?.lichessLinked && user.lichessUsername);

  const load = useCallback(async () => {
    if (!user || !linked) return;
    const { data } = await api.get<ImportState>('/v2/games/import');
    if (data.status !== 'done') {
      setState({ kind: 'to-import', username: user.lichessUsername!, state: data });
      return;
    }
    const { data: list } = await api.get<{ games: ImportedGame[] }>('/v2/games');
    const source = importedSource(user.lichessUsername!, list.games, (data.finishedAt ?? new Date().toISOString()).slice(0, 10));
    cached = { userId: user.id, source };
    setState({ kind: 'ready', source });
  }, [user, linked]);

  useEffect(() => {
    if (loading) return;
    if (linked) {
      if (cached?.userId === user!.id) setState({ kind: 'ready', source: cached.source });
      else load().catch(() => setState({ kind: 'to-import', username: user!.lichessUsername!, state: { status: 'failed', imported: 0, error: 'Your games could not be loaded. Try again.' } }));
      return;
    }
    setState(demo ? { kind: 'ready', source: DEMO_SOURCE } : { kind: 'signed-out' });
  }, [loading, linked, user, demo, load]);

  // Pendant l'import, son état se relit jusqu'à la fin.
  const running = state.kind === 'to-import' && state.state.status === 'running';
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => void load().catch(() => undefined), 1500);
    return () => window.clearTimeout(timer);
  }, [running, state, load]);

  const startImport = useCallback(async () => {
    if (state.kind !== 'to-import') return;
    try {
      const { data } = await api.post<ImportState>('/v2/games/import');
      setState({ ...state, state: data });
    } catch {
      setState({ ...state, state: { status: 'failed', imported: 0, error: 'The import could not start. Try again in a minute.' } });
    }
  }, [state]);

  return { state, startImport, tryDemo: () => setDemo(true), leaveDemo: () => setDemo(false) };
}
