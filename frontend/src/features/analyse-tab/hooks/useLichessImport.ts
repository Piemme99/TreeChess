import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { importApi, usernameStorage } from '../../../services/api';
import { toast } from '../../../stores/toastStore';
import type { LichessImportOptions } from '../../../types';

export interface UseLichessImportReturn {
  importing: boolean;
  handleLichessImport: (options?: LichessImportOptions) => Promise<boolean>;
}

export function useLichessImport(username: string, onSuccess?: () => void): UseLichessImportReturn {
  const navigate = useNavigate();
  const [importing, setImporting] = useState(false);

  const handleLichessImport = useCallback(async (options?: LichessImportOptions) => {
    if (!username.trim()) {
      toast.error('Please enter your Lichess username first');
      return false;
    }

    usernameStorage.set(username.trim());
    setImporting(true);

    try {
      const result = await importApi.importFromLichess(username.trim(), options);
      toast.success(`Imported ${result.gameCount} game(s) from Lichess`);
      onSuccess?.();
      navigate(`/analyse/${result.id}`);
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
  }, [username, navigate, onSuccess]);

  return { importing, handleLichessImport };
}
