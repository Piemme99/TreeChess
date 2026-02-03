import { useState, useCallback } from 'react';
import { studyApi } from '../../../../services/api';
import { toast } from '../../../../stores/toastStore';
import type { StudyInfo, StudyImportResponse } from '../../../../types';

export interface UseStudyImportReturn {
  previewing: boolean;
  importing: boolean;
  studyInfo: StudyInfo | null;
  previewError: string | null;
  handlePreview: (url: string) => Promise<boolean>;
  handleImport: (studyUrl: string, chapters: number[], mergeAsOne?: boolean, mergeName?: string, createCategory?: boolean, categoryName?: string) => Promise<StudyImportResponse | null>;
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

  const handleImport = useCallback(async (studyUrl: string, chapters: number[], mergeAsOne?: boolean, mergeName?: string, createCategory?: boolean, categoryName?: string) => {
    if (chapters.length === 0) {
      toast.error('Please select at least one chapter');
      return null;
    }

    setImporting(true);

    try {
      const result = await studyApi.import(studyUrl, chapters, mergeAsOne, mergeName, createCategory, categoryName);
      toast.success(
        mergeAsOne
          ? `Imported ${chapters.length} chapter(s) as 1 merged repertoire`
          : createCategory && result.category
            ? `Imported ${result.count} repertoire(s) into category "${result.category.name}"`
            : `Imported ${result.count} repertoire(s) from Lichess study`
      );
      onSuccess?.();
      return result;
    } catch (error) {
      const axiosError = error as { response?: { data?: { error?: string }; status?: number } };
      const errorMessage = axiosError.response?.data?.error || 'Failed to import study';
      toast.error(errorMessage);
      return null;
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
