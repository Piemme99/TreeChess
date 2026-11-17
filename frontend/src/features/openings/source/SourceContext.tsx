import { Fragment, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { PageSkeleton } from '../workshop/PageSkeleton';
import { useV2Path } from '../workshop/routes';
import { setStorageScope } from '../workshop/storage';
import type { GameSource } from './gameSource';
import { useGameSource } from './useGameSource';
import { SourceContext } from './useSource';

export function SourceProvider({ source, children }: { source: GameSource; children: ReactNode }) {
  // Avant le premier rendu des enfants : leurs états se lisent du stockage de cette source.
  setStorageScope(source.id);
  return (
    <SourceContext.Provider value={source}>
      <Fragment key={source.id}>{children}</Fragment>
    </SourceContext.Provider>
  );
}

/** Une page qui lit des parties : sans source prête, Home dit quoi faire (se connecter, importer). */
export function SourceGate({ children }: { children: ReactNode }) {
  const { state } = useGameSource();
  const pathOf = useV2Path();
  if (state.kind === 'loading') return <PageSkeleton />;
  if (state.kind !== 'ready') return <Navigate to={pathOf('home')} replace />;
  return <SourceProvider source={state.source}>{children}</SourceProvider>;
}
