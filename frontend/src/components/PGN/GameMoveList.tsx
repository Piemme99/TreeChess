import { useRef, useEffect } from 'react';
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

function getMoveClass(status: MoveAnalysis['status']): string {
  switch (status) {
    case 'in-repertoire':
      return 'move-in-repertoire';
    case 'out-of-repertoire':
      return 'move-out-repertoire';
    case 'opponent-new':
      return 'move-opponent-new';
    default:
      return '';
  }
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

  const showExpectedMoveError = (move: MoveAnalysis) => {
    return move.status === 'out-of-repertoire' && move.expectedMove;
  };

  const showAddButton = (move: MoveAnalysis) => {
    return move.status === 'out-of-repertoire' || move.status === 'opponent-new';
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
                className={`move-cell ${getMoveClass(pair.white.status)} ${currentMoveIndex === pair.whiteIndex ? 'selected' : ''}`}
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
                className={`move-cell ${getMoveClass(pair.black.status)} ${currentMoveIndex === pair.blackIndex ? 'selected' : ''}`}
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

      {/* Show error details for selected move */}
      {currentMoveIndex >= 0 && currentMoveIndex < displayedMoves.length && (
        <div className="selected-move-details">
          {showExpectedMoveError(displayedMoves[currentMoveIndex]) && (
            <div className="expected-move-info">
              <span className="expected-label">Expected:</span>
              <span className="expected-san">{displayedMoves[currentMoveIndex].expectedMove}</span>
            </div>
          )}
          {showAddButton(displayedMoves[currentMoveIndex]) && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onAddToRepertoire(displayedMoves[currentMoveIndex])}
            >
              {displayedMoves[currentMoveIndex].status === 'opponent-new' ? 'Prepare Response' : 'Add to Repertoire'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
