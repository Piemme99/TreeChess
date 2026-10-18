import { useEffect } from 'react';

const FONT_URL = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&display=swap';

export function useWorkshopFont() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_URL;
    document.head.appendChild(link);
    return () => link.remove();
  }, []);
}
