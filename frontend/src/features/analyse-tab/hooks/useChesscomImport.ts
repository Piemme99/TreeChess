import { useState, useCallback } from 'react';
import { importApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';
import { sanitizeUsername } from '../utils/sanitizeUsername';
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
      const axiosError = error as { response?: { data?: { error?: string }; status?: number } };
      const errorMessage = axiosError.response?.data?.error || 'Failed to import from Chess.com';
      toast.error(errorMessage);
      return false;
    } finally {
      setImporting(false);
    }
  }, [username, onSuccess]);

  return { importing, handleChesscomImport };
}
