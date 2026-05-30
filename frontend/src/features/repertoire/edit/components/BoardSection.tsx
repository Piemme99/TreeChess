import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { ExternalLink } from 'lucide-react';
import { ChessBoard } from '../../../../shared/components/Board/ChessBoard';
import type { BoardDrawModifiers } from '../../../../shared/components/Board/ChessBoard';
import { OpeningLabel } from '../../../../shared/components/OpeningLabel';
import { useChess } from '../../../../shared/hooks/useChess';
import { findNode, findPathToNode } from '../utils/nodeUtils';
import { colorFromModifiers } from '../utils/annotations';
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
  pendingMoveArrow?: [string, string, string][];
  exploring?: boolean;
  explorationFens?: string[];
  allowDrawing?: boolean;
  onDrawArrow?: (from: string, to: string, color: string) => void;
  onDrawHighlight?: (square: string, color: string) => void;
}

export function BoardSection({
  selectedNode,
  repertoire,
  currentFEN,
  color,
  possibleMoves,
  setPossibleMoves,
  onMove,
  engineEvaluation,
  pendingMoveArrow = [],
  exploring = false,
  explorationFens = [],
  allowDrawing = false,
  onDrawArrow,
  onDrawHighlight
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

  const annotationArrows = useMemo<[string, string, string?][]>(() => {
    if (!selectedNode?.arrows?.length) return [];
    return selectedNode.arrows.map((a) => [a.from, a.to, a.color] as [string, string, string]);
  }, [selectedNode?.arrows]);

  const annotationSquareStyles = useMemo<Record<string, React.CSSProperties>>(() => {
    if (!selectedNode?.highlights?.length) return {};
    const styles: Record<string, React.CSSProperties> = {};
    for (const h of selectedNode.highlights) {
      styles[h.square] = { backgroundColor: h.color + '80' };
    }
    return styles;
  }, [selectedNode?.highlights]);

  const bestMoveArrow = useMemo<[string, string, string?][]>(() => {
    if (engineEvaluation?.bestMoveFrom && engineEvaluation?.bestMoveTo) {
      return [[engineEvaluation.bestMoveFrom, engineEvaluation.bestMoveTo, '#e67e22']];
    }
    return [];
  }, [engineEvaluation?.bestMoveFrom, engineEvaluation?.bestMoveTo]);

  const allArrows = useMemo<[string, string, string?][]>(
    () => [...annotationArrows, ...bestMoveArrow, ...pendingMoveArrow],
    [annotationArrows, bestMoveArrow, pendingMoveArrow]
  );

  const handleDrawArrow = useCallback((from: string, to: string, mods: BoardDrawModifiers) => {
    onDrawArrow?.(from, to, colorFromModifiers(mods));
  }, [onDrawArrow]);

  const handleDrawHighlight = useCallback((square: string, mods: BoardDrawModifiers) => {
    onDrawHighlight?.(square, colorFromModifiers(mods));
  }, [onDrawHighlight]);

  const handleSquareClick = (square: string) => {
    if (!color || !selectedNode) return;

    // Legal moves come from the displayed position, which differs from the
    // selected node while exploring.
    const moves = getLegalMoves(currentFEN);
    const targetSquares = moves.map((m) => m.to);

    if (possibleMoves.includes(square)) {
      const moveInfo = moves.find((m) => m.to === square);
      if (moveInfo) {
        onMove({ san: moveInfo.san });
      }
      setPossibleMoves([]);
      return;
    }

    // The tree-node interception only applies to the committed tree, not to a
    // free exploration from the current position.
    if (!exploring) {
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
    }

    if (targetSquares.includes(square)) {
      setPossibleMoves(targetSquares);
    } else {
      setPossibleMoves([]);
    }
  };

  const fenPath = useMemo(() => {
    if (!repertoire || !selectedNode) return [];
    const path = findPathToNode(repertoire.treeData, selectedNode.id);
    const base = path ? path.map((n) => n.fen) : [];
    return [...base, ...explorationFens];
  }, [repertoire, selectedNode, explorationFens]);

  const truncatedFEN = currentFEN.length > 60 ? currentFEN.slice(0, 57) + '...' : currentFEN;
  const orientationLabel = color === 'white' ? 'White' : color === 'black' ? 'Black' : '';

  return (
    <div className="flex flex-col items-center justify-center h-full max-md:w-full">
      <OpeningLabel fenPath={fenPath} className="w-full px-3 shrink-0" />
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
            customArrows={allArrows}
            annotationSquareStyles={annotationSquareStyles}
            allowDrawing={allowDrawing}
            onDrawArrow={handleDrawArrow}
            onDrawHighlight={handleDrawHighlight}
          />
        </div>
      </div>
      <div className="w-full flex items-center justify-between px-3 py-1.5 border-t border-border bg-bg">
        <span className="font-mono text-xs text-text-muted truncate max-w-[70%]" title={currentFEN}>
          {truncatedFEN}
        </span>
        <div className="flex items-center gap-2">
          <a
            href={`https://lichess.org/analysis/${currentFEN.split(' ').join('_')}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Analyse on Lichess"
            className="text-text-muted hover:text-text transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          {orientationLabel && (
            <span className="text-xs text-text-muted flex items-center gap-1">
              <span className={`inline-block w-2.5 h-2.5 rounded-full border border-border-dark ${color === 'white' ? 'bg-white' : 'bg-gray-800'}`} />
              {orientationLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
