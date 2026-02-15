import { useEffect, useRef } from 'react';

const APP_NAME = import.meta.env.DEV ? '[DEV] Kumquat' : 'Kumquat';

export function usePageTitle(title: string) {
  const previousTitle = useRef(document.title);

  useEffect(() => {
    const prev = previousTitle.current;
    document.title = `${title} - ${APP_NAME}`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
