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
      return [[engineEvaluation.bestMoveFrom, engineEvaluation.bestMoveTo, 'rgba(0, 120, 255, 0.6)']];
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

  return (
    <div className="flex items-center justify-center aspect-square h-full shrink-0 max-md:w-full">
      <EvalBar score={engineEvaluation?.score} mate={engineEvaluation?.mate} />
      <div className="w-full h-full flex items-center justify-center p-2" ref={wrapperRef}>
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
  );
}
