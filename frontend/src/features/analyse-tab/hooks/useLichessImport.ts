import { useState, useCallback } from 'react';
import { importApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';
import { sanitizeUsername } from '../utils/sanitizeUsername';
import { getApiErrorMessage } from '../../../shared/utils/apiError';
import type { LichessImportOptions } from '../../../types';

export interface UseLichessImportReturn {
  importing: boolean;
  handleLichessImport: (options?: LichessImportOptions) => Promise<boolean>;
}

export function useLichessImport(username: string, onSuccess?: () => void): UseLichessImportReturn {
  const [importing, setImporting] = useState(false);

  const handleLichessImport = useCallback(async (options?: LichessImportOptions) => {
    const cleanedUsername = sanitizeUsername(username);
    if (!cleanedUsername) {
      toast.error('Please enter your Lichess username first');
      return false;
    }

    setImporting(true);

    try {
      const result = await importApi.importFromLichess(cleanedUsername, options);
      toast.success(`Imported ${result.gameCount} game(s) from Lichess`);
      onSuccess?.();
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to import from Lichess'));
      return false;
    } finally {
      setImporting(false);
    }
  }, [username, onSuccess]);

  return { importing, handleLichessImport };
}
