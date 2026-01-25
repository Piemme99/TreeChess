import { useState, KeyboardEvent } from 'react';
import { Button, Modal } from '../../../../shared/components/UI';

interface AddMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (move: string, setError: (error: string) => void) => Promise<boolean>;
  actionLoading: boolean;
  prefillMove?: string;
}

export function AddMoveModal({
  isOpen,
  onClose,
  onSubmit,
  actionLoading,
  prefillMove = ''
}: AddMoveModalProps) {
  const [moveInput, setMoveInput] = useState(prefillMove);
  const [moveError, setMoveError] = useState('');

  const handleSubmit = async () => {
    const success = await onSubmit(moveInput, setMoveError);
    if (success) {
      onClose();
      setMoveInput('');
      setMoveError('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Move"
      size="sm"
      footer={
        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={actionLoading}
            disabled={!moveInput.trim()}
          >
            Add
          </Button>
        </div>
      }
    >
      <div className="add-move-form">
        <label htmlFor="move-input">Move (SAN notation)</label>
        <input
          id="move-input"
          type="text"
          value={moveInput}
          onChange={(e) => {
            setMoveInput(e.target.value);
            setMoveError('');
          }}
          placeholder="e.g., e4, Nf3, O-O, e8=Q"
          className={moveError ? 'input-error' : ''}
          autoFocus
          onKeyDown={handleKeyDown}
        />
        {moveError && <p className="error-message">{moveError}</p>}
      </div>
    </Modal>
  );
}