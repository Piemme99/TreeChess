import type { EngineEvaluation } from '../../../../types';
import { stockfishService } from '../../../../services/stockfish';

interface TopMovesPanelProps {
  evaluation?: EngineEvaluation | null;
  fen?: string;
}

export function TopMovesPanel({ evaluation, fen }: TopMovesPanelProps) {
  if (!evaluation || !evaluation.pv || evaluation.pv.length === 0) return null;

  // PV is a sequence of moves, not multiple best moves
  // The first move in PV is the best move, followed by the expected continuation
  const bestMoveUCI = evaluation.pv[0];
  const bestMoveSAN = stockfishService.uciToSAN(bestMoveUCI, fen);

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

      {evaluation.pv.length > 1 && (
        <div style={{ marginTop: '8px', fontSize: '13px', color: '#666' }}>
          <span style={{ fontWeight: 'bold' }}>Line: </span>
          {evaluation.pv.slice(0, 6).map((move, i) => (
            <span key={i} style={{ marginRight: '4px' }}>
              {stockfishService.uciToSAN(move, fen)}
            </span>
          ))}
          {evaluation.pv.length > 6 && '...'}
        </div>
      )}
    </div>
  );
}
