import { useAnalysisBase } from '../../../shared/hooks';

/**
 * Hook for loading analysis data in the import detail view.
 * Uses the shared useAnalysisBase hook.
 */
export function useAnalysisLoader() {
  const { analysis, loading } = useAnalysisBase();
  return { analysis, loading };
}
