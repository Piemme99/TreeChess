import { useState, useCallback } from 'react';
import { importApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';
import type { LichessImportOptions } from '../../../types';

export interface UseLichessImportReturn {
  importing: boolean;
  handleLichessImport: (options?: LichessImportOptions) => Promise<boolean>;
}

export function useLichessImport(username: string, onSuccess?: () => void): UseLichessImportReturn {
  const [importing, setImporting] = useState(false);

  const handleLichessImport = useCallback(async (options?: LichessImportOptions) => {
    if (!username.trim()) {
      toast.error('Please enter your Lichess username first');
      return false;
    }

    setImporting(true);

    try {
      const result = await importApi.importFromLichess(username.trim(), options);
      toast.success(`Imported ${result.gameCount} game(s) from Lichess`);
      onSuccess?.();
      return true;
    } catch (error) {
      // Extract error message from axios error
      const axiosError = error as { response?: { data?: { error?: string }; status?: number } };
      const errorMessage = axiosError.response?.data?.error || 'Failed to import from Lichess';
      toast.error(errorMessage);
      return false;
    } finally {
      setImporting(false);
    }
  }, [username, onSuccess]);

  return { importing, handleLichessImport };
}
