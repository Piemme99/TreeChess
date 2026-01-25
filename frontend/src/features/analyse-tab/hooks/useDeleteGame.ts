import { useState, useCallback } from 'react';
import { gamesApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';

interface DeleteTarget {
  analysisId: string;
  gameIndex: number;
}

export function useDeleteGame(onSuccess: (analysisId: string, gameIndex: number) => void) {
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await gamesApi.delete(deleteTarget.analysisId, deleteTarget.gameIndex);
      onSuccess(deleteTarget.analysisId, deleteTarget.gameIndex);
      toast.success('Game deleted');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete game');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, onSuccess]);

  return { deleteTarget, setDeleteTarget, deleting, handleDelete };
}
