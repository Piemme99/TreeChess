// PROTOTYPE — la position affichée rattrape la position visée coup par coup, au lieu de sauter.
// Un court temps d'arrêt avant de bouger évite que l'échiquier tremble quand le curseur balaie.
import { useEffect, useRef, useState } from 'react';
import { play } from './sounds';

const DWELL_MS = 90;
const PLY_MS = 170;

const commonPrefix = (a: readonly string[], b: readonly string[]) => {
  let length = 0;
  while (length < a.length && length < b.length && a[length] === b[length]) length++;
  return length;
};

export function useReplayedPath(target: readonly string[], mode: 'replay' | 'jump'): readonly string[] {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  const targetKey = target.join(' ');

  useEffect(() => {
    const show = (path: readonly string[]) => {
      shownRef.current = path;
      setShown(path);
    };

    if (mode === 'jump') {
      const timer = setTimeout(() => show(target), DWELL_MS);
      return () => clearTimeout(timer);
    }

    let interval: ReturnType<typeof setInterval> | undefined;
    const step = () => {
      const current = shownRef.current;
      const shared = commonPrefix(current, target);
      if (shared < current.length) return show(target.slice(0, shared));
      if (current.length >= target.length) return clearInterval(interval);
      show(target.slice(0, current.length + 1));
      play(target[current.length].includes('x') ? 'capture' : 'clack');
    };
    const timer = setTimeout(() => {
      step();
      interval = setInterval(step, PLY_MS);
    }, DWELL_MS);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la cible est identifiée par sa clé
  }, [targetKey, mode]);

  return shown;
}
