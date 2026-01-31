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
        <div className="flex gap-2">
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
      <div className="flex flex-col gap-2">
        <label htmlFor="move-input" className="font-medium text-text-muted">Move (SAN notation)</label>
        <input
          id="move-input"
          type="text"
          value={moveInput}
          onChange={(e) => {
            setMoveInput(e.target.value);
            setMoveError('');
          }}
          placeholder="e.g., e4, Nf3, O-O, e8=Q"
          className={`py-2 px-4 border rounded-md text-base font-mono focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-light ${moveError ? 'border-danger' : 'border-border'}`}
          autoFocus
          onKeyDown={handleKeyDown}
        />
        {moveError && <p className="text-danger text-sm">{moveError}</p>}
      </div>

      {suggestedMove && (
        <div className="mt-3 p-3 bg-primary-light rounded-md border-l-4 border-l-[#2196f3]">
          <div className="text-sm mb-1">
            Stockfish suggests: <strong>{suggestedMove}</strong>
            {suggestedScore !== null && suggestedScore !== undefined && (
              <span className="ml-2 text-text-muted">
                ({stockfishService.formatScore(suggestedScore)}, depth {suggestedDepth})
              </span>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
