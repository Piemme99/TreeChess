import { useState, useCallback } from 'react';
import { repertoireApi } from '../../../../services/api';
import { toast } from '../../../../stores/toastStore';
import type { Repertoire, RepertoireNode } from '../../../../types';

interface UseMainLineActionsResult {
  mainLineLoading: boolean;
  mergeLoading: boolean;
  hasMainLine: (node: RepertoireNode) => boolean;
  handleSetMainLine: () => Promise<void>;
  handleClearMainLine: () => Promise<void>;
  handleMergeTranspositions: () => Promise<void>;
}

/**
 * Manages main line and transposition merge actions for a repertoire.
 */
export function useMainLineActions(
  repertoireId: string | undefined,
  selectedNodeId: string | null,
  setRepertoire: (r: Repertoire) => void,
): UseMainLineActionsResult {
  const [mainLineLoading, setMainLineLoading] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);

  const hasMainLine = useCallback((node: RepertoireNode): boolean => {
    if (node.isMainLine) return true;
    return node.children.some(hasMainLine);
  }, []);

  const handleSetMainLine = useCallback(async () => {
    if (!repertoireId || !selectedNodeId) return;
    setMainLineLoading(true);
    try {
      const updated = await repertoireApi.setMainLine(repertoireId, selectedNodeId);
      setRepertoire(updated);
      toast.success('Main line set');
    } catch {
      toast.error('Failed to set main line');
    } finally {
      setMainLineLoading(false);
    }
  }, [repertoireId, selectedNodeId, setRepertoire]);

  const handleClearMainLine = useCallback(async () => {
    if (!repertoireId) return;
    setMainLineLoading(true);
    try {
      const updated = await repertoireApi.clearMainLine(repertoireId);
      setRepertoire(updated);
      toast.success('Main line cleared');
    } catch {
      toast.error('Failed to clear main line');
    } finally {
      setMainLineLoading(false);
    }
  }, [repertoireId, setRepertoire]);

  const handleMergeTranspositions = useCallback(async () => {
    if (!repertoireId) return;
    setMergeLoading(true);
    try {
      const updated = await repertoireApi.mergeTranspositions(repertoireId);
      setRepertoire(updated);
      toast.success('Transpositions merged');
    } catch {
      toast.error('Failed to merge transpositions');
    } finally {
      setMergeLoading(false);
    }
  }, [repertoireId, setRepertoire]);

  return {
    mainLineLoading,
    mergeLoading,
    hasMainLine,
    handleSetMainLine,
    handleClearMainLine,
    handleMergeTranspositions,
  };
}
