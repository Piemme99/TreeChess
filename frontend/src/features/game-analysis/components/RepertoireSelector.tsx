import { useState, useEffect, useCallback } from 'react';
import { repertoireApi } from '../../../services/api';
import { Button } from '../../../shared/components/UI';
import type { Repertoire, Color, RepertoireRef } from '../../../types';

interface RepertoireSelectorProps {
  userColor: Color;
  currentRepertoire: RepertoireRef | null | undefined;
  matchScore?: number;
  onReanalyze: (repertoireId: string) => Promise<boolean>;
}

export function RepertoireSelector({ userColor, currentRepertoire, matchScore, onReanalyze }: RepertoireSelectorProps) {
  const [repertoires, setRepertoires] = useState<Repertoire[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>(currentRepertoire?.id || '');
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  useEffect(() => {
    async function loadRepertoires() {
      try {
        const data = await repertoireApi.list(userColor);
        setRepertoires(data);
      } catch {
        console.error('Failed to load repertoires');
      } finally {
        setLoading(false);
      }
    }
    loadRepertoires();
  }, [userColor]);

  useEffect(() => {
    setSelectedId(currentRepertoire?.id || '');
  }, [currentRepertoire?.id]);

  const handleReanalyze = useCallback(async () => {
    if (!selectedId || selectedId === currentRepertoire?.id) return;

    setIsReanalyzing(true);
    await onReanalyze(selectedId);
    setIsReanalyzing(false);
  }, [selectedId, currentRepertoire?.id, onReanalyze]);

  const hasChanged = selectedId !== (currentRepertoire?.id || '');

  if (loading) {
    return (
      <div className="flex items-center gap-4 py-2 px-6 bg-primary-light text-text text-sm border-b border-border">
        <span className="font-medium whitespace-nowrap">Analyzed against:</span>
        <span className="text-text-muted italic">Loading repertoires...</span>
      </div>
    );
  }

  if (repertoires.length === 0) {
    return (
      <div className="flex items-center gap-4 py-2 px-6 bg-warning-light text-text text-sm border-b border-border">
        <span>No {userColor} repertoire available. Create one to analyze games.</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 py-2 px-6 bg-primary-light text-text text-sm border-b border-border">
      <span className="font-medium whitespace-nowrap">Analyzed against:</span>
      <select
        className="flex-1 max-w-[300px] py-1 px-2 font-sans text-sm border border-border rounded-sm bg-bg-card text-text cursor-pointer focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light disabled:opacity-60 disabled:cursor-not-allowed"
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        disabled={isReanalyzing}
      >
        {!currentRepertoire && <option value="">No repertoire selected</option>}
        {repertoires.map((rep) => (
          <option key={rep.id} value={rep.id}>
            {rep.name}
          </option>
        ))}
      </select>
      {!hasChanged && matchScore !== undefined && matchScore > 0 && (
        <span className="text-text-muted text-[0.8125rem] whitespace-nowrap">
          ({matchScore} moves matched)
        </span>
      )}
      {hasChanged && (
        <Button
          variant="primary"
          size="sm"
          onClick={handleReanalyze}
          disabled={isReanalyzing || !selectedId}
        >
          {isReanalyzing ? 'Reanalyzing...' : 'Reanalyze'}
        </Button>
      )}
    </div>
  );
}
