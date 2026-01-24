import { useRef, useEffect, useMemo } from 'react';
import { Button } from '../UI';
import type { MoveAnalysis } from '../../types';

interface GameMoveListProps {
  moves: MoveAnalysis[];
  currentMoveIndex: number;
  maxDisplayedIndex: number;
  onMoveClick: (index: number) => void;
  onAddToRepertoire: (move: MoveAnalysis) => void;
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
  showFullGame,
  hasMoreMoves,
  onToggleFullGame
}: GameMoveListProps) {
  const selectedRef = useRef<HTMLDivElement>(null);

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

  // Check if the first actionable move is an opponent-new (the one we want to add)
  const firstOpponentNewIndex = useMemo(() => {
    return displayedMoves.findIndex((m) => m.status === 'opponent-new');
  }, [displayedMoves]);

  // Get the CSS class for a move based on its index and status
  // Only color moves up to and including the first actionable move, rest are neutral
  function getMoveClass(index: number, status: MoveAnalysis['status']): string {
    // If there's no actionable move yet, or this move is before the first actionable
    if (firstActionableIndex === -1 || index < firstActionableIndex) {
      if (status === 'in-repertoire') return 'move-in-repertoire';
    }

    // This is the first actionable move
    if (index === firstActionableIndex) {
      if (status === 'opponent-new') return 'move-opponent-new';
      if (status === 'out-of-repertoire') return 'move-out-repertoire';
    }

    // All moves after the first actionable move are neutral (no class)
    return '';
  }

  // Group moves by pairs (white, black)
  const movePairs: { moveNumber: number; white?: MoveAnalysis; black?: MoveAnalysis; whiteIndex?: number; blackIndex?: number }[] = [];

  displayedMoves.forEach((move, index) => {
    const moveNumber = Math.floor(move.plyNumber / 2) + 1;
    const isWhite = move.plyNumber % 2 === 0;

    let pair = movePairs.find((p) => p.moveNumber === moveNumber);
    if (!pair) {
      pair = { moveNumber };
      movePairs.push(pair);
    }

    if (isWhite) {
      pair.white = move;
      pair.whiteIndex = index;
    } else {
      pair.black = move;
      pair.blackIndex = index;
    }
  });

  // Only show expected move info for out-of-repertoire errors
  const showExpectedMoveError = (index: number, move: MoveAnalysis) => {
    return index === firstActionableIndex && move.status === 'out-of-repertoire' && move.expectedMove;
  };

  // Only show add button for the first opponent-new move
  const showAddButton = (index: number) => {
    return index === firstOpponentNewIndex && firstOpponentNewIndex !== -1;
  };

  const hiddenMovesCount = moves.length - displayedMoves.length;

  return (
    <div className="game-moves-list">
      <div className="moves-list">
        {movePairs.map((pair) => (
          <div key={pair.moveNumber} className="move-row">
            <span className="move-number">{pair.moveNumber}.</span>

            {pair.white && pair.whiteIndex !== undefined ? (
              <div
                ref={currentMoveIndex === pair.whiteIndex ? selectedRef : null}
                className={`move-cell ${getMoveClass(pair.whiteIndex, pair.white.status)} ${currentMoveIndex === pair.whiteIndex ? 'selected' : ''}`}
                onClick={() => onMoveClick(pair.whiteIndex!)}
              >
                <span className="move-san">{pair.white.san}</span>
              </div>
            ) : (
              <div className="move-cell empty" />
            )}

            {pair.black && pair.blackIndex !== undefined ? (
              <div
                ref={currentMoveIndex === pair.blackIndex ? selectedRef : null}
                className={`move-cell ${getMoveClass(pair.blackIndex, pair.black.status)} ${currentMoveIndex === pair.blackIndex ? 'selected' : ''}`}
                onClick={() => onMoveClick(pair.blackIndex!)}
              >
                <span className="move-san">{pair.black.san}</span>
              </div>
            ) : (
              <div className="move-cell empty" />
            )}
          </div>
        ))}
      </div>

      {/* Toggle full game button */}
      {hasMoreMoves && (
        <div className="show-more-section">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleFullGame}
            className="show-more-btn"
          >
            {showFullGame
              ? 'Show opening only'
              : `Show full game (+${hiddenMovesCount} moves)`}
          </Button>
        </div>
      )}

      {/* Show error details for selected move (only for first error) */}
      {currentMoveIndex >= 0 && currentMoveIndex < displayedMoves.length && (
        <div className="selected-move-details">
          {showExpectedMoveError(currentMoveIndex, displayedMoves[currentMoveIndex]) && (
            <div className="expected-move-info">
              <span className="expected-label">Expected:</span>
              <span className="expected-san">{displayedMoves[currentMoveIndex].expectedMove}</span>
            </div>
          )}
          {showAddButton(currentMoveIndex) && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onAddToRepertoire(displayedMoves[currentMoveIndex])}
            >
              Add to Repertoire
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
