import { useEffect, useState } from 'react';

const STORAGE = 'kumquat.v2.imported';

export function useImported() {
  const [imported, setImported] = useState(() => localStorage.getItem(STORAGE) === '1');
  useEffect(() => localStorage.setItem(STORAGE, imported ? '1' : '0'), [imported]);
  return [imported, setImported] as const;
}
