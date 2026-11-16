import { useCallback, useEffect, useState } from 'react';

export interface ToastMessage {
  text: string;
  undo?: () => void;
}

const DURATION = 7000;
// Sans Undo, rien à rattraper : le toast libère vite la barre du bas qu'il recouvre au téléphone.
const SHORT = 4000;

/** Le retour d'une action, avec de quoi la défaire tant qu'il est affiché. */
export function useToast() {
  const [toast, setToast] = useState<(ToastMessage & { stamp: number }) | null>(null);
  const show = useCallback((message: ToastMessage) => setToast({ ...message, stamp: Date.now() }), []);
  const close = useCallback(() => setToast(null), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(close, toast.undo ? DURATION : SHORT);
    return () => clearTimeout(timer);
  }, [toast, close]);
  return { toast, show, close };
}
