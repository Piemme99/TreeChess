import { useState, useCallback } from 'react';
import { importApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';

export interface UseFileUploadReturn {
  uploading: boolean;
  handleFileUpload: (file: File) => Promise<boolean>;
}

export function useFileUpload(username: string, onSuccess?: () => void): UseFileUploadReturn {
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pgn')) {
      toast.error('Please select a .pgn file');
      return false;
    }

    if (!username.trim()) {
      toast.error('Please enter your username first');
      return false;
    }

    setUploading(true);

    try {
      const result = await importApi.upload(file, username.trim());
      toast.success(`Imported ${result.gameCount} game(s)`);
      onSuccess?.();
      return true;
    } catch {
      toast.error('Failed to upload PGN file');
      return false;
    } finally {
      setUploading(false);
    }
  }, [username, onSuccess]);

  return { uploading, handleFileUpload };
}