import { useMemo } from 'react';
import { Chess } from 'chess.js';
import type { EngineEvaluation } from '../../../../types';
import { stockfishService } from '../../../../services/stockfish';

interface TopMovesPanelProps {
  evaluation?: EngineEvaluation | null;
  fen?: string;
}

export function TopMovesPanel({ evaluation, fen }: TopMovesPanelProps) {
  // Convert PV (principal variation) UCI moves to SAN using sequential positions
  const pvSanMoves = useMemo(() => {
    if (!evaluation?.pv || evaluation.pv.length === 0 || !fen) return [];

    const sanMoves: string[] = [];
    try {
      const chess = new Chess(fen);
      for (const uciMove of evaluation.pv.slice(0, 6)) {
        // Convert UCI move to SAN using current position before applying the move
        const san = stockfishService.uciToSAN(uciMove, chess.fen());
        if (san === uciMove) {
          // If conversion failed (returned original UCI), skip remaining moves
          break;
        }
        sanMoves.push(san);
        // Apply the move to advance to next position
        const from = uciMove.slice(0, 2);
        const to = uciMove.slice(2, 4);
        const promotion = uciMove.length > 4 ? uciMove[4] : undefined;
        const result = chess.move({ from, to, promotion });
        if (!result) {
          // Invalid move, stop processing
          break;
        }
      }
    } catch {
      // If anything fails, return what we have so far
    }
    return sanMoves;
  }, [evaluation?.pv, fen]);

  if (!evaluation || !evaluation.pv || evaluation.pv.length === 0) return null;

  const bestMoveSAN = pvSanMoves[0] || stockfishService.uciToSAN(evaluation.pv[0], fen);

  return (
    <div className="top-moves-panel" style={{ padding: '16px', background: '#f5f5f5', borderRadius: '8px', marginTop: '16px' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold' }}>
        Engine Analysis (depth {evaluation.depth})
      </h3>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
        <div>
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
            Best: {bestMoveSAN}
          </span>
          <span style={{ marginLeft: '12px', fontSize: '14px', color: '#666' }}>
            {stockfishService.formatScore(evaluation.score)}
            {evaluation.mate && ` (Mate in ${Math.abs(evaluation.mate)})`}
          </span>
        </div>
      </div>

      {pvSanMoves.length > 1 && (
        <div style={{ marginTop: '8px', fontSize: '13px', color: '#666' }}>
          <span style={{ fontWeight: 'bold' }}>Line: </span>
          {pvSanMoves.map((san, i) => (
            <span key={i} style={{ marginRight: '4px' }}>
              {san}
            </span>
          ))}
          {evaluation.pv.length > 6 && '...'}
        </div>
      )}
    </div>
  );
}
