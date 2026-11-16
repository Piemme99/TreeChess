import { useEffect } from 'react';

const FONT_URL = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&display=swap';

// Posée une fois et gardée : retirée à chaque changement de page, elle se rechargeait et le texte passait par la police système.
export function useWorkshopFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_URL}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_URL;
    document.head.appendChild(link);
  }, []);
}
