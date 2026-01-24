import { useState, useCallback } from 'react';
import { importApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';

export function useDeleteAnalysis(onSuccess: (id: string) => void) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;

    setDeleting(true);
    try {
      await importApi.delete(deleteId);
      onSuccess(deleteId);
      toast.success('Analysis deleted');
      setDeleteId(null);
    } catch {
      toast.error('Failed to delete analysis');
    } finally {
      setDeleting(false);
    }
  }, [deleteId, onSuccess]);

  return { deleteId, setDeleteId, deleting, handleDelete };
}