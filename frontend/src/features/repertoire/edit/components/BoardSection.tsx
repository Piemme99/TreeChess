import { ChessBoard } from '../../../../shared/components/Board/ChessBoard';
import { useChess } from '../../../../shared/hooks/useChess';
import { findNode } from '../utils/nodeUtils';
import type { RepertoireNode, Color, Repertoire } from '../../../../types';

interface BoardSectionProps {
  selectedNode: RepertoireNode | null;
  repertoire: Repertoire | null;
  currentFEN: string;
  color: Color | undefined;
  possibleMoves: string[];
  setPossibleMoves: (moves: string[]) => void;
  onMove: (move: { san: string }) => void;
}

export function BoardSection({
  selectedNode,
  repertoire,
  currentFEN,
  color,
  possibleMoves,
  setPossibleMoves,
  onMove
}: BoardSectionProps) {
  const { getLegalMoves } = useChess();

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
      <div className="chessboard-wrapper">
        <ChessBoard
          fen={currentFEN}
          orientation={color}
          onMove={onMove}
          onSquareClick={handleSquareClick}
          highlightSquares={possibleMoves}
          interactive={true}
          width={350}
        />
      </div>
    </div>
  );
}