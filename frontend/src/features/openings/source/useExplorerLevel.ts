import { useContext, useMemo } from 'react';
import { explorerLevel, playerRating, type ExplorerLevel } from '../domain/level';
import { SourceContext } from './useSource';

/** Le niveau où lire l'explorateur, d'après les parties du joueur ; la page de dev Games n'a pas de source. */
export function useExplorerLevel(): ExplorerLevel {
  const source = useContext(SourceContext);
  const rating = useMemo(() => playerRating(source?.games ?? []), [source]);
  // Le classement, pas la source : la source se relit au chargement, les tranches doivent rester les mêmes objets.
  return useMemo(() => explorerLevel(rating), [rating]);
}
