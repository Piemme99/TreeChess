import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Button } from '../../../shared/components/UI';
import { StudyImportModal } from '../../repertoire/shared/components/StudyImportModal';
import { useRepertoireStore } from '../../../stores/repertoireStore';
import { toast } from '../../../stores/toastStore';
import type { MoveAnalysis, Color } from '../../../types';

interface GameMoveListProps {
  moves: MoveAnalysis[];
  currentMoveIndex: number;
  maxDisplayedIndex: number;
  onMoveClick: (index: number) => void;
  onAddToRepertoire?: (move: MoveAnalysis, moveIndex: number) => void;
  onCreateAndAdd?: (repertoireId: string) => void;
  onImportSuccess?: () => void;
  userColor?: Color;
  openingName?: string;
  showFullGame: boolean;
  hasMoreMoves: boolean;
  onToggleFullGame: () => void;
}

export function GameMoveList({
  moves,
  currentMoveIndex,
  maxDisplayedIndex,
  onMoveClick,
  onAddToRepertoire,
  onCreateAndAdd,
  onImportSuccess,
  userColor,
  openingName,
  showFullGame,
  hasMoreMoves,
  onToggleFullGame
}: GameMoveListProps) {
  const selectedRef = useRef<HTMLDivElement>(null);
  const [showStudyModal, setShowStudyModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const { createRepertoire } = useRepertoireStore();

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !userColor) {
      toast.error('Please enter a name');
      return;
    }

    setCreateLoading(true);
    try {
      const rep = await createRepertoire(newName.trim(), userColor);
      setNewName('');
      setIsCreating(false);
      toast.success('Repertoire created');
      onCreateAndAdd?.(rep.id);
    } catch {
      toast.error('Failed to create repertoire');
    } finally {
      setCreateLoading(false);
    }
  }, [newName, userColor, createRepertoire, onCreateAndAdd]);

  const handleImportSuccess = useCallback(() => {
    setShowStudyModal(false);
    onImportSuccess?.();
  }, [onImportSuccess]);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentMoveIndex]);

  // Filter moves to only show up to maxDisplayedIndex
  const displayedMoves = moves.slice(0, maxDisplayedIndex + 1);

  // Find the index of the first actionable move (opponent-new or out-of-repertoire)
  const firstActionableIndex = useMemo(() => {
    return displayedMoves.findIndex(
      (m) => m.status === 'opponent-new' || m.status === 'out-of-repertoire'
    );
  }, [displayedMoves]);

  // Get the Tailwind classes for a move based on its index and status
  // Only color moves up to and including the first actionable move, rest are neutral
  function getMoveClasses(index: number, status: MoveAnalysis['status']): string {
    // If there's no actionable move yet, or this move is before the first actionable
    if (firstActionableIndex === -1 || index < firstActionableIndex) {
      if (status === 'in-repertoire') return 'bg-success-light text-success';
    }

    // This is the first actionable move
    if (index === firstActionableIndex) {
      if (status === 'opponent-new') return 'bg-info-light text-info';
      if (status === 'out-of-repertoire') return 'bg-danger-light text-danger';
    }

    // All moves after the first actionable move are neutral (no class)
    return '';
  }

  // Group moves by pairs (white, black)
  const movePairs = useMemo(() => {
    const pairs: { moveNumber: number; white?: MoveAnalysis; black?: MoveAnalysis; whiteIndex?: number; blackIndex?: number }[] = [];

    displayedMoves.forEach((move, index) => {
      const moveNumber = Math.floor(move.plyNumber / 2) + 1;
      const isWhite = move.plyNumber % 2 === 0;

      let pair = pairs.find((p) => p.moveNumber === moveNumber);
      if (!pair) {
        pair = { moveNumber };
        pairs.push(pair);
      }

      if (isWhite) {
        pair.white = move;
        pair.whiteIndex = index;
      } else {
        pair.black = move;
        pair.blackIndex = index;
      }
    });

    return pairs;
  }, [displayedMoves]);

  // Only show expected move info for out-of-repertoire errors
  const showExpectedMoveError = (index: number, move: MoveAnalysis) => {
    return index === firstActionableIndex && move.status === 'out-of-repertoire' && move.expectedMove;
  };

  // Show add button for any selected move at or after the first actionable index
  const showAddButton = (index: number) => {
    return onAddToRepertoire && firstActionableIndex !== -1 && index >= firstActionableIndex;
  };

  // Compute button label: single move vs sequence
  const getAddButtonLabel = (index: number) => {
    if (firstActionableIndex === -1) return 'Add to Repertoire';
    const count = index - firstActionableIndex + 1;
    if (count <= 1) return 'Add to Repertoire';
    return `Add ${count} moves to Repertoire`;
  };

  const hiddenMovesCount = moves.length - displayedMoves.length;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto flex flex-col gap-1">
        {movePairs.map((pair) => (
          <div key={pair.moveNumber} className="flex items-stretch gap-1">
            <span className="font-mono text-text-muted min-w-[32px] flex items-center text-sm">{pair.moveNumber}.</span>

            {pair.white && pair.whiteIndex !== undefined ? (
              <div
                ref={currentMoveIndex === pair.whiteIndex ? selectedRef : null}
                className={`flex-1 py-1 px-2 rounded-sm cursor-pointer transition-all duration-150 flex items-center font-mono text-[0.9rem] hover:brightness-95 ${getMoveClasses(pair.whiteIndex, pair.white.status)} ${currentMoveIndex === pair.whiteIndex ? 'outline-2 outline-primary outline-offset-1' : ''}`}
                onClick={() => onMoveClick(pair.whiteIndex!)}
              >
                <span className="font-medium">{pair.white.san}</span>
              </div>
            ) : (
              <div className="flex-1 cursor-default bg-transparent" />
            )}

            {pair.black && pair.blackIndex !== undefined ? (
              <div
                ref={currentMoveIndex === pair.blackIndex ? selectedRef : null}
                className={`flex-1 py-1 px-2 rounded-sm cursor-pointer transition-all duration-150 flex items-center font-mono text-[0.9rem] hover:brightness-95 ${getMoveClasses(pair.blackIndex, pair.black.status)} ${currentMoveIndex === pair.blackIndex ? 'outline-2 outline-primary outline-offset-1' : ''}`}
                onClick={() => onMoveClick(pair.blackIndex!)}
              >
                <span className="font-medium">{pair.black.san}</span>
              </div>
            ) : (
              <div className="flex-1 cursor-default bg-transparent" />
            )}
          </div>
        ))}
      </div>

      {/* Toggle full game button */}
      {hasMoreMoves && (
        <div className="flex justify-center py-2 mt-2 border-t border-dashed border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleFullGame}
            className="text-sm text-primary"
          >
            {showFullGame
              ? 'Show opening only'
              : `Show full game (+${hiddenMovesCount} moves)`}
          </Button>
        </div>
      )}

      {/* Show error details for selected move (only for first error) */}
      {currentMoveIndex >= 0 && currentMoveIndex < displayedMoves.length && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2">
          {showExpectedMoveError(currentMoveIndex, displayedMoves[currentMoveIndex]) && (
            <div className="flex items-center gap-2 p-2 bg-danger-light rounded-sm">
              <span className="text-text-muted text-sm">Expected:</span>
              <span className="font-mono font-semibold text-danger">{displayedMoves[currentMoveIndex].expectedMove}</span>
            </div>
          )}
          {showAddButton(currentMoveIndex) && onAddToRepertoire && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onAddToRepertoire(displayedMoves[currentMoveIndex], currentMoveIndex)}
            >
              {getAddButtonLabel(currentMoveIndex)}
            </Button>
          )}
          {showAddButton(currentMoveIndex) && userColor && (
            <div className="flex flex-col gap-2 pt-2 border-t border-dashed border-border mt-2">
              <span className="text-xs text-text-muted">Or add to a new repertoire:</span>
              {isCreating ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Repertoire name"
                    className="flex-1 py-1 px-2 border border-border rounded-sm text-sm bg-bg text-text focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate();
                      if (e.key === 'Escape') {
                        setIsCreating(false);
                        setNewName('');
                      }
                    }}
                  />
                  <Button variant="primary" size="sm" onClick={handleCreate} disabled={createLoading}>
                    {createLoading ? 'Creating...' : 'Create'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setIsCreating(false); setNewName(''); }} disabled={createLoading}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setIsCreating(true)}>
                    Create New Repertoire
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowStudyModal(true);
                      const lichessUrl = openingName
                        ? `https://lichess.org/study/search?q=${encodeURIComponent(openingName)}`
                        : 'https://lichess.org/study';
                      window.open(lichessUrl, '_blank');
                    }}
                  >
                    Import from Lichess
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <StudyImportModal
        isOpen={showStudyModal}
        onClose={() => setShowStudyModal(false)}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}
