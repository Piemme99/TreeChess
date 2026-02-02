import { useRef, useState, useEffect, useMemo } from 'react';
import { ChessBoard } from '../../../../shared/components/Board/ChessBoard';
import { useChess } from '../../../../shared/hooks/useChess';
import { findNode } from '../utils/nodeUtils';
import { EvalBar } from './EvalBar';
import type { RepertoireNode, Color, Repertoire, EngineEvaluation } from '../../../../types';

interface BoardSectionProps {
  selectedNode: RepertoireNode | null;
  repertoire: Repertoire | null;
  currentFEN: string;
  color: Color | undefined;
  possibleMoves: string[];
  setPossibleMoves: (moves: string[]) => void;
  onMove: (move: { san: string }) => void;
  engineEvaluation?: EngineEvaluation | null;
}

export function BoardSection({
  selectedNode,
  repertoire,
  currentFEN,
  color,
  possibleMoves,
  setPossibleMoves,
  onMove,
  engineEvaluation
}: BoardSectionProps) {
  const { getLegalMoves } = useChess();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(500);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setBoardSize(Math.floor(Math.min(width, height)));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const bestMoveArrow = useMemo<[string, string, string?][]>(() => {
    if (engineEvaluation?.bestMoveFrom && engineEvaluation?.bestMoveTo) {
      return [[engineEvaluation.bestMoveFrom, engineEvaluation.bestMoveTo, 'rgba(230, 126, 34, 0.6)']];
    }
    return [];
  }, [engineEvaluation?.bestMoveFrom, engineEvaluation?.bestMoveTo]);

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

  const truncatedFEN = currentFEN.length > 60 ? currentFEN.slice(0, 57) + '...' : currentFEN;
  const orientationLabel = color === 'white' ? 'White' : color === 'black' ? 'Black' : '';

  return (
    <div className="flex flex-col items-center justify-center h-full shrink-0 max-md:w-full">
      <div className="flex items-center justify-center flex-1 min-h-0 w-full">
        <EvalBar score={engineEvaluation?.score} mate={engineEvaluation?.mate} fen={currentFEN} />
        <div className="w-full h-full flex items-center justify-center p-2 aspect-square" ref={wrapperRef}>
          <ChessBoard
            fen={currentFEN}
            orientation={color}
            onMove={onMove}
            onSquareClick={handleSquareClick}
            highlightSquares={possibleMoves}
            interactive={true}
            width={boardSize}
            customArrows={bestMoveArrow}
          />
        </div>
      </div>
      <div className="w-full flex items-center justify-between px-3 py-1.5 border-t border-border bg-bg">
        <span className="font-mono text-xs text-text-muted truncate max-w-[70%]" title={currentFEN}>
          {truncatedFEN}
        </span>
        {orientationLabel && (
          <span className="text-xs text-text-muted flex items-center gap-1">
            <span className={`inline-block w-2.5 h-2.5 rounded-full border border-border-dark ${color === 'white' ? 'bg-white' : 'bg-gray-800'}`} />
            {orientationLabel}
          </span>
        )}
      </div>
    </div>
  );
}
