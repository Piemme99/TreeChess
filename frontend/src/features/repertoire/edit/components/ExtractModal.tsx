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
        <div className="modal-actions">
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
      <div style={{ marginTop: '1rem' }}>
        <label htmlFor="extract-name" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
          New repertoire name
        </label>
        <input
          id="extract-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          style={{
            width: '100%',
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid var(--color-border, #ccc)',
            background: 'var(--color-bg-input, #fff)',
            color: 'var(--color-text, #000)',
            fontSize: '0.9rem'
          }}
        />
      </div>
    </Modal>
  );
}
