import { useState, KeyboardEvent } from 'react';
import { Button, Modal } from '../../../../shared/components/UI';
import { stockfishService } from '../../../../services/stockfish';
import type { EngineEvaluation } from '../../../../types';

interface AddMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (move: string, setError: (error: string) => void) => Promise<boolean>;
  actionLoading: boolean;
  prefillMove?: string;
  evaluation?: EngineEvaluation | null;
  fen?: string;
}

export function AddMoveModal({
  isOpen,
  onClose,
  onSubmit,
  actionLoading,
  prefillMove = '',
  evaluation,
  fen
}: AddMoveModalProps) {
  const [moveInput, setMoveInput] = useState(prefillMove);
  const [moveError, setMoveError] = useState('');

  // Get the best move from PV or bestMove field, convert to SAN
  const bestMoveUCI = evaluation?.pv?.[0] || evaluation?.bestMove;
  const suggestedMove = bestMoveUCI ? stockfishService.uciToSAN(bestMoveUCI, fen) : null;
  const suggestedScore = evaluation?.score;
  const suggestedDepth = evaluation?.depth;

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

      {suggestedMove && (
        <div className="stockfish-suggestion" style={{ marginTop: '12px', padding: '12px', background: '#e3f2fd', borderRadius: '6px', borderLeft: '4px solid #2196f3' }}>
          <div style={{ fontSize: '14px', marginBottom: '4px' }}>
            Stockfish suggests: <strong>{suggestedMove}</strong>
            {suggestedScore && (
              <span style={{ marginLeft: '8px', color: '#666' }}>
                ({stockfishService.formatScore(suggestedScore)}, depth {suggestedDepth})
              </span>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}