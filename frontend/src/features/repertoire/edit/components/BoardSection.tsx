import { ChessBoard } from '../../../../shared/components/Board/ChessBoard';
import { useChess } from '../../../../shared/hooks/useChess';
import { findNode } from '../utils/nodeUtils';
import type { RepertoireNode, Color, Repertoire, EngineEvaluation } from '../../../../types';
import { stockfishService } from '../../../../services/stockfish';

interface BoardSectionProps {
  selectedNode: RepertoireNode | null;
  repertoire: Repertoire | null;
  currentFEN: string;
  color: Color | undefined;
  possibleMoves: string[];
  setPossibleMoves: (moves: string[]) => void;
  onMove: (move: { san: string }) => void;
  currentEvaluation?: EngineEvaluation | null;
  isAnalyzing?: boolean;
}

export function BoardSection({
  selectedNode,
  repertoire,
  currentFEN,
  color,
  possibleMoves,
  setPossibleMoves,
  onMove,
  currentEvaluation,
  isAnalyzing
}: BoardSectionProps) {
  const { getLegalMoves } = useChess();

  const getScoreDisplay = () => {
    if (isAnalyzing) return 'Analyzing...';
    if (currentEvaluation?.mate !== undefined && currentEvaluation?.mate !== null) return `Mate in ${currentEvaluation.mate}`;
    if (currentEvaluation) return stockfishService.formatScore(currentEvaluation.score);
    return null;
  };

  const scoreColor = () => {
    if (!currentEvaluation || currentEvaluation.score > 0) return '#4caf50';
    return '#f44336';
  };

  const handleSquareClick = (square: string) => {
    if (!color || !selectedNode) return;

    const moves = getLegalMoves(selectedNode.fen);
    const targetSquares = moves.map((m) => m.to);

    if (possibleMoves.includes(square)) {
      const moveInfo = moves.find((m) => m.to === square);
      if (moveInfo) {
        onMove({ san: moveInfo.san });
      }
      setPossibleMoves([]);
      return;
    }

    const targetToNodeId = new Map<string, string>();
    for (const child of selectedNode.children) {
      if (child.move) {
        const destSquare = child.move.slice(-2);
        targetToNodeId.set(destSquare, child.id);
      }
    }
    const nodeId = targetToNodeId.get(square);
    if (nodeId && repertoire) {
      const nodeForSquare = findNode(repertoire.treeData, nodeId);
      if (nodeForSquare) {
        return;
      }
    }

    if (targetSquares.includes(square)) {
      setPossibleMoves(targetSquares);
    } else {
      setPossibleMoves([]);
    }
  };

  const scoreDisplay = getScoreDisplay();

  return (
    <div className="repertoire-edit-board">
      <div className="panel-header">
        <h2>Position</h2>
        {selectedNode && (
          <span className="position-info">
            {selectedNode.move
              ? `${selectedNode.moveNumber}${selectedNode.colorToMove === 'w' ? '.' : '...'} ${selectedNode.move}`
              : 'Starting Position'}
          </span>
        )}
      </div>
      {scoreDisplay && (
        <div className="score-indicator" style={{ color: scoreColor(), fontSize: '18px', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
          {scoreDisplay}
        </div>
      )}
      <div className="chessboard-wrapper">
        <ChessBoard
          fen={currentFEN}
          orientation={color}
          onMove={onMove}
          onSquareClick={handleSquareClick}
          highlightSquares={possibleMoves}
          interactive={true}
          width={350}
          bestMoveFrom={currentEvaluation?.bestMoveFrom}
          bestMoveTo={currentEvaluation?.bestMoveTo}
        />
      </div>
    </div>
  );
}