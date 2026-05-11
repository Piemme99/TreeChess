import { useState, useCallback } from 'react';
import { studyApi } from '../../../../services/api';
import { toast } from '../../../../stores/toastStore';
import type {
  StudyInfo,
  StudyImportResponse,
  StudyImportRenameStrategy,
  RepertoireNameConflict,
} from '../../../../types';

export type StudyImportOutcome =
  | { kind: 'success'; result: StudyImportResponse }
  | { kind: 'conflict'; conflicts: RepertoireNameConflict[] }
  | { kind: 'error' };

export interface UseStudyImportReturn {
  previewing: boolean;
  importing: boolean;
  studyInfo: StudyInfo | null;
  previewError: string | null;
  handlePreview: (url: string) => Promise<boolean>;
  handleImport: (
    studyUrl: string,
    chapters: number[],
    mergeAsOne?: boolean,
    mergeName?: string,
    createCategory?: boolean,
    categoryName?: string,
    includeComments?: boolean,
    includeHints?: boolean,
    ownerName?: string,
    renameStrategy?: StudyImportRenameStrategy,
  ) => Promise<StudyImportOutcome>;
  reset: () => void;
}

export function useStudyImport(onSuccess?: () => void): UseStudyImportReturn {
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [studyInfo, setStudyInfo] = useState<StudyInfo | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const handlePreview = useCallback(async (url: string) => {
    if (!url.trim()) {
      setPreviewError('Please enter a Lichess study URL');
      return false;
    }

    setPreviewing(true);
    setPreviewError(null);
    setStudyInfo(null);

    try {
      const info = await studyApi.preview(url.trim());
      setStudyInfo(info);
      return true;
    } catch (error) {
      const axiosError = error as { response?: { data?: { error?: string }; status?: number } };
      const errorMessage = axiosError.response?.data?.error || 'Failed to fetch study from Lichess';
      setPreviewError(errorMessage);
      return false;
    } finally {
      setPreviewing(false);
    }
  }, []);

  const handleImport = useCallback(async (
    studyUrl: string,
    chapters: number[],
    mergeAsOne?: boolean,
    mergeName?: string,
    createCategory?: boolean,
    categoryName?: string,
    includeComments?: boolean,
    includeHints?: boolean,
    ownerName?: string,
    renameStrategy?: StudyImportRenameStrategy,
  ): Promise<StudyImportOutcome> => {
    if (chapters.length === 0) {
      toast.error('Please select at least one chapter');
      return { kind: 'error' };
    }

    setImporting(true);

    try {
      const result = await studyApi.import(
        studyUrl,
        chapters,
        mergeAsOne,
        mergeName,
        createCategory,
        categoryName,
        includeComments,
        includeHints,
        ownerName,
        renameStrategy,
      );
      toast.success(
        mergeAsOne
          ? `Imported ${chapters.length} chapter(s) as 1 merged repertoire`
          : createCategory && result.category
            ? `Imported ${result.count} repertoire(s) into category "${result.category.name}"`
            : `Imported ${result.count} repertoire(s) from Lichess study`
      );
      if (result.skipped && result.skipped.length > 0) {
        const n = result.skipped.length;
        toast.warning(`${n} chapter${n > 1 ? 's' : ''} skipped (custom starting position not yet supported)`);
      }
      onSuccess?.();
      return { kind: 'success', result };
    } catch (error) {
      const axiosError = error as {
        response?: {
          data?: { error?: string; type?: string; conflicts?: RepertoireNameConflict[] };
          status?: number;
        };
      };
      const data = axiosError.response?.data;
      if (axiosError.response?.status === 409 && data?.type === 'name-conflict' && data.conflicts) {
        // Don't toast — the caller renders an inline panel offering resolutions.
        return { kind: 'conflict', conflicts: data.conflicts };
      }
      const errorMessage = data?.error || 'Failed to import study';
      toast.error(errorMessage);
      return { kind: 'error' };
    } finally {
      setImporting(false);
    }
  }, [onSuccess]);

  const reset = useCallback(() => {
    setStudyInfo(null);
    setPreviewError(null);
    setPreviewing(false);
    setImporting(false);
  }, []);

  return { previewing, importing, studyInfo, previewError, handlePreview, handleImport, reset };
}
