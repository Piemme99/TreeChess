import { createContext, useContext } from 'react';
import type { GameSource } from './gameSource';

export const SourceContext = createContext<GameSource | null>(null);

export function useSource(): GameSource {
  const source = useContext(SourceContext);
  if (!source) throw new Error('useSource outside a SourceProvider');
  return source;
}
