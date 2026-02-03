import { useState, useEffect, useCallback } from 'react';
import { repertoireApi } from '../../../services/api';
import { Button } from '../../../shared/components/UI';
import { StudyImportModal } from '../../repertoire/shared/components/StudyImportModal';
import { useRepertoireStore } from '../../../stores/repertoireStore';
import { toast } from '../../../stores/toastStore';
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
  const [showStudyModal, setShowStudyModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const { createRepertoire } = useRepertoireStore();

  const loadRepertoires = useCallback(async () => {
    try {
      const data = await repertoireApi.list(userColor);
      setRepertoires(data);
    } catch {
      console.error('Failed to load repertoires');
    } finally {
      setLoading(false);
    }
  }, [userColor]);

  useEffect(() => {
    loadRepertoires();
  }, [loadRepertoires]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    setCreateLoading(true);
    try {
      const rep = await createRepertoire(newName.trim(), userColor);
      setNewName('');
      setIsCreating(false);
      await loadRepertoires();
      setSelectedId(rep.id);
      toast.success('Repertoire created');
    } catch {
      toast.error('Failed to create repertoire');
    } finally {
      setCreateLoading(false);
    }
  }, [newName, userColor, createRepertoire, loadRepertoires]);

  const handleImportSuccess = useCallback(async () => {
    await loadRepertoires();
  }, [loadRepertoires]);

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
      <>
        <div className="flex items-center gap-4 py-2 px-6 bg-warning-light text-text text-sm border-b border-border">
          <span className="whitespace-nowrap">No {userColor} repertoire available.</span>
          {isCreating ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Repertoire name"
                className="flex-1 max-w-[200px] py-1 px-2 border border-border rounded-sm text-sm bg-bg-card text-text focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewName('');
                  }
                }}
              />
              <Button variant="primary" size="sm" onClick={handleCreate} disabled={createLoading}>
                {createLoading ? 'Creating...' : 'Create'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setIsCreating(false); setNewName(''); }} disabled={createLoading}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={() => setIsCreating(true)}>
                Create New
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowStudyModal(true);
                  window.open('https://lichess.org/study', '_blank');
                }}
              >
                Import from Lichess
              </Button>
            </div>
          )}
        </div>
        <StudyImportModal
          isOpen={showStudyModal}
          onClose={() => setShowStudyModal(false)}
          onSuccess={handleImportSuccess}
        />
      </>
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
