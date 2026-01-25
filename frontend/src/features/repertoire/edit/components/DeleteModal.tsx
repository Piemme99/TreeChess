import { ConfirmModal } from '../../../../shared/components/UI';

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
  moveName: string | null | undefined;
  actionLoading: boolean;
}

export function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  moveName,
  actionLoading
}: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={async () => {
        const success = await onConfirm();
        if (success) {
          onClose();
        }
      }}
      title="Delete Branch"
      message={`Are you sure you want to delete this branch? This will remove "${moveName || ''}" and all its variations.`}
      confirmText="Delete"
      variant="danger"
      loading={actionLoading}
    />
  );
}