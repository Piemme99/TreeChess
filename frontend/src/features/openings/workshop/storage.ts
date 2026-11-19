import { api, getAccessToken } from '../../../services/api';

/** Les décisions que le serveur garde pour un compte importé ; la démo les laisse dans le navigateur. */
export const SAVED_KEYS = ['additions', 'ignored-checks', 'kept-moves', 'removals', 'review', 'worked'] as const;

const API_BASE = import.meta.env.VITE_API_URL || '/api';
// Assez court pour qu'une décision soit sauvée avant qu'on ferme la page, assez long pour grouper un Undo.
const SAVE_DELAY = 300;

// Chaque source de parties a ses décisions : la démo garde les clés d'avant, un compte importé a les siennes.
let scope = '';
let server: Map<string, string> | null = null;
const pending = new Map<string, { timer: number; value: string }>();

export function setStorageScope(sourceId: string, saved?: Map<string, string>) {
  const next = sourceId === 'demo' ? '' : `${sourceId}.`;
  // Les parties d'un compte se relisent (double chargement, nouvelles parties) avec ce que le serveur avait au
  // moment de la lecture : dans un même onglet, ce que la page a écrit depuis est plus récent.
  if (saved && server && saved !== server && next === scope) for (const [key, value] of server) saved.set(key, value);
  scope = next;
  server = saved ?? null;
}

export const storageKey = (key: string) => `kumquat.v2.${scope}${key}`;

const onServer = (key: string) => server !== null && (SAVED_KEYS as readonly string[]).includes(key);

export function readStored(key: string): string | null {
  return onServer(key) ? (server!.get(key) ?? null) : localStorage.getItem(storageKey(key));
}

export function writeStored(key: string, value: string) {
  if (!onServer(key)) {
    localStorage.setItem(storageKey(key), value);
    return;
  }
  // Le serveur rend ses objets dans son ordre de clés : comparer les valeurs, pas le texte.
  const known = server!.get(key);
  if (known === value || (known !== undefined && sameJson(known, value))) return;
  server!.set(key, value);
  window.clearTimeout(pending.get(key)?.timer);
  pending.set(key, { value, timer: window.setTimeout(() => save(key, value), SAVE_DELAY) });
}

function save(key: string, value: string, attempt = 0) {
  pending.delete(key);
  const from = scope;
  api.put(`/v2/state/${key}`, value, { headers: { 'Content-Type': 'application/json' } }).catch(() => {
    // Ne réessayer que si rien de plus récent n'a été écrit depuis, et pour le même compte.
    const current = attempt < 3 && scope === from && !pending.has(key) && server?.get(key) === value;
    if (current) pending.set(key, { value, timer: window.setTimeout(() => save(key, value, attempt + 1), 2000 * (attempt + 1)) });
  });
}

/** Une décision prise juste avant de fermer la page part quand même. */
export function flushStored() {
  for (const [key, { timer, value }] of pending) {
    window.clearTimeout(timer);
    void fetch(`${API_BASE}/v2/state/${key}`, {
      method: 'PUT',
      keepalive: true,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAccessToken() ?? ''}` },
      body: value,
    });
  }
  pending.clear();
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', flushStored);

/**
 * Au premier chargement d'un compte, ce que le navigateur gardait déjà (avant que le serveur ne le fasse) monte
 * au serveur ; ensuite, le serveur fait foi.
 */
export function mergeSaved(fromServer: Record<string, unknown>, local: (key: string) => string | null) {
  const values = new Map<string, string>();
  const upload: string[] = [];
  for (const key of SAVED_KEYS) {
    if (key in fromServer) values.set(key, JSON.stringify(fromServer[key]));
    else {
      const kept = local(key);
      if (kept !== null) {
        values.set(key, kept);
        upload.push(key);
      }
    }
  }
  return { values, upload };
}

export function uploadStored(keys: readonly string[], values: Map<string, string>) {
  for (const key of keys) {
    const value = values.get(key);
    if (value !== undefined) void api.put(`/v2/state/${key}`, value, { headers: { 'Content-Type': 'application/json' } }).catch(() => undefined);
  }
}

function sameJson(a: string, b: string): boolean {
  const equal = (x: unknown, y: unknown): boolean => {
    if (x === y) return true;
    if (typeof x !== 'object' || typeof y !== 'object' || x === null || y === null) return false;
    if (Array.isArray(x) !== Array.isArray(y)) return false;
    const xs = Object.keys(x);
    const ys = Object.keys(y);
    return xs.length === ys.length && xs.every((key) => equal((x as Record<string, unknown>)[key], (y as Record<string, unknown>)[key]));
  };
  return equal(JSON.parse(a), JSON.parse(b));
}
