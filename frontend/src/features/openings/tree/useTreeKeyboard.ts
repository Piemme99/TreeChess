import { useEffect, useEffectEvent } from 'react';
import { mostPlayed, nodeAlong } from './repertoireMap';
import type { TreeWalk } from './useTreeWalk';

/** ← → ↑ ↓ et Home parcourent la carte, comme sur Lichess ; la construction a ses propres touches. */
export function useTreeKeyboard({ root, path, node, play, walk, back }: TreeWalk, enabled: boolean) {
  const press = useEffectEvent((event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]')) return;
    const inRepertoire = path.length === node.path.length;
    const parent = path.length ? nodeAlong(root, path.slice(0, -1)) : null;
    const siblings = parent && inRepertoire ? parent.children.filter((child) => !child.stub) : [];
    const at = siblings.findIndex((child) => child.san === path[path.length - 1]);
    if (event.key === 'ArrowLeft' && path.length) back();
    else if (event.key === 'ArrowRight' && inRepertoire && node.children.length) {
      play(mostPlayed(node)!.san!);
    } else if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && siblings.length > 1 && at >= 0) {
      // Sans boucler : ↑ au premier frère ne doit pas sauter tout en bas de la carte.
      const next = siblings[Math.min(siblings.length - 1, Math.max(0, at + (event.key === 'ArrowDown' ? 1 : -1)))];
      if (next.san !== path[path.length - 1]) walk([...path.slice(0, -1), next.san!]);
    } else if (event.key === 'Home') walk([]);
    else return;
    event.preventDefault();
  });
  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => press(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [enabled]);
}
