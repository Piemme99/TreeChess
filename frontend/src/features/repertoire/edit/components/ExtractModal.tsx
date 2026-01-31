import { useState, useEffect } from 'react';
import { Modal, Button } from '../../../../shared/components/UI';

interface ExtractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => Promise<boolean>;
  defaultName: string;
  actionLoading: boolean;
}

export function ExtractModal({
  isOpen,
  onClose,
  onConfirm,
  defaultName,
  actionLoading
}: ExtractModalProps) {
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
    }
  }, [isOpen, defaultName]);

  const handleConfirm = async () => {
    const success = await onConfirm(name);
    if (success) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Extract to New Repertoire"
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={actionLoading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm} loading={actionLoading}>
            Extract
          </Button>
        </div>
      }
    >
      <p>This will extract the selected branch and all its variations into a new repertoire. The branch will be removed from the current repertoire.</p>
      <div className="mt-4">
        <label htmlFor="extract-name" className="block mb-2 font-medium">
          New repertoire name
        </label>
        <input
          id="extract-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className="w-full py-2 px-3 rounded-sm border border-border bg-bg-card text-text text-[0.9rem] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
        />
      </div>
    </Modal>
  );
}
