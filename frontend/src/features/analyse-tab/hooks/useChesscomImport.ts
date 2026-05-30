import { useState, useCallback } from 'react';
import { importApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';
import { sanitizeUsername } from '../utils/sanitizeUsername';
import { getApiErrorMessage } from '../../../shared/utils/apiError';
import type { ChesscomImportOptions } from '../../../types';

export interface UseChesscomImportReturn {
  importing: boolean;
  handleChesscomImport: (options?: ChesscomImportOptions) => Promise<boolean>;
}

export function useChesscomImport(username: string, onSuccess?: () => void): UseChesscomImportReturn {
  const [importing, setImporting] = useState(false);

  const handleChesscomImport = useCallback(async (options?: ChesscomImportOptions) => {
    const cleanedUsername = sanitizeUsername(username);
    if (!cleanedUsername) {
      toast.error('Please enter your Chess.com username first');
      return false;
    }

    setImporting(true);

    try {
      const result = await importApi.importFromChesscom(cleanedUsername, options);
      toast.success(`Imported ${result.gameCount} game(s) from Chess.com`);
      onSuccess?.();
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to import from Chess.com'));
      return false;
    } finally {
      setImporting(false);
    }
  }, [username, onSuccess]);

  return { importing, handleChesscomImport };
}
