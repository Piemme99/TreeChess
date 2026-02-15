import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Globe, Lock } from 'lucide-react';
import { Button } from '../../../../shared/components/UI';
import { repertoireApi } from '../../../../services/api';
import { useRepertoireStore } from '../../../../stores/repertoireStore';
import { toast } from '../../../../stores/toastStore';
import type { Repertoire } from '../../../../types';

interface RepertoireSettingsPanelProps {
  repertoire: Repertoire;
  onUpdate: (repertoire: Repertoire) => void;
  onClose: () => void;
}

export function RepertoireSettingsPanel({ repertoire, onUpdate, onClose }: RepertoireSettingsPanelProps) {
  const [name, setName] = useState(repertoire.name);
  const [description, setDescription] = useState(repertoire.description || '');
  const { renameRepertoire, updateDescription } = useRepertoireStore();

  const nameSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when repertoire changes externally
  useEffect(() => {
    setName(repertoire.name);
    setDescription(repertoire.description || '');
  }, [repertoire.name, repertoire.description]);

  const saveName = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === repertoire.name) return;
    try {
      await renameRepertoire(repertoire.id, trimmed);
      const updated = await repertoireApi.get(repertoire.id);
      onUpdate(updated);
    } catch {
      toast.error('Failed to update name');
      setName(repertoire.name);
    }
  }, [repertoire.id, repertoire.name, renameRepertoire, onUpdate]);

  const saveDescription = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed === (repertoire.description || '')) return;
    try {
      await updateDescription(repertoire.id, trimmed);
      const updated = await repertoireApi.get(repertoire.id);
      onUpdate(updated);
    } catch {
      toast.error('Failed to update description');
      setDescription(repertoire.description || '');
    }
  }, [repertoire.id, repertoire.description, updateDescription, onUpdate]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    if (nameSaveTimer.current) clearTimeout(nameSaveTimer.current);
    nameSaveTimer.current = setTimeout(() => saveName(value), 800);
  }, [saveName]);

  const handleNameBlur = useCallback(() => {
    if (nameSaveTimer.current) {
      clearTimeout(nameSaveTimer.current);
      nameSaveTimer.current = null;
    }
    saveName(name);
  }, [saveName, name]);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDescription(value);
    if (descSaveTimer.current) clearTimeout(descSaveTimer.current);
    descSaveTimer.current = setTimeout(() => saveDescription(value), 800);
  }, [saveDescription]);

  const handleDescriptionBlur = useCallback(() => {
    if (descSaveTimer.current) {
      clearTimeout(descSaveTimer.current);
      descSaveTimer.current = null;
    }
    saveDescription(description);
  }, [saveDescription, description]);

  const handleToggleVisibility = useCallback(async () => {
    try {
      const updated = await repertoireApi.updateVisibility(repertoire.id, !repertoire.isPublic);
      onUpdate(updated);
      toast.success(updated.isPublic ? 'Repertoire is now public' : 'Repertoire is now private');
    } catch {
      toast.error('Failed to update visibility');
    }
  }, [repertoire.id, repertoire.isPublic, onUpdate]);

  return (
    <div className="absolute top-full left-0 mt-1 w-80 bg-bg-card border border-primary/15 rounded-xl shadow-xl z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10">
        <h3 className="text-sm font-semibold text-text">Repertoire Settings</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-bg transition-colors text-text-muted hover:text-text cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Name */}
        <div>
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5 block">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={handleNameChange}
            onBlur={handleNameBlur}
            maxLength={100}
            className="w-full py-2 px-3 text-sm border border-primary/10 rounded-lg bg-bg text-text focus:outline-none focus:border-primary/40 placeholder:text-text-muted transition-colors"
            placeholder="Repertoire name"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5 flex items-center justify-between">
            <span>Description</span>
            <span className="font-normal normal-case tracking-normal">{description.length}/500</span>
          </label>
          <textarea
            value={description}
            onChange={handleDescriptionChange}
            onBlur={handleDescriptionBlur}
            maxLength={500}
            rows={3}
            className="w-full py-2 px-3 text-sm border border-primary/10 rounded-lg bg-bg text-text resize-y min-h-[4rem] focus:outline-none focus:border-primary/40 placeholder:text-text-muted transition-colors"
            placeholder="Add a description to help others discover your repertoire..."
          />
        </div>

        {/* Visibility */}
        <div>
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5 block">
            Visibility
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleToggleVisibility}
            className="w-full justify-center gap-2"
          >
            {repertoire.isPublic ? (
              <>
                <Globe className="w-3.5 h-3.5 text-primary" />
                <span>Public</span>
                <span className="text-text-muted font-normal">- visible in Explore</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Private</span>
                <span className="text-text-muted font-normal">- only you can see it</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
