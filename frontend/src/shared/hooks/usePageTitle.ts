import { useEffect, useRef } from 'react';

export function usePageTitle(title: string) {
  const previousTitle = useRef(document.title);

  useEffect(() => {
    const prev = previousTitle.current;
    document.title = `${title} - Kumquat`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
