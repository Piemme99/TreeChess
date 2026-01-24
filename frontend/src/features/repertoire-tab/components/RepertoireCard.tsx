import { Button } from '../../../components/UI';
import type { Color } from '../../../types';

export interface RepertoireCardProps {
  color: Color;
  totalMoves: number;
  totalNodes: number;
  deepestDepth: number;
  onEdit: () => void;
}

export function RepertoireCard({ color, totalMoves, totalNodes, deepestDepth, onEdit }: RepertoireCardProps) {
  const isWhite = color === 'white';

  return (
    <div className={`repertoire-card ${isWhite ? 'repertoire-card-white' : 'repertoire-card-black'}`}>
      <div className="repertoire-card-icon">
        {isWhite ? '♔' : '♚'}
      </div>
      <h3 className="repertoire-card-title">
        {isWhite ? 'White' : 'Black'} Repertoire
      </h3>
      <div className="repertoire-card-stats">
        <div className="stat">
          <span className="stat-value">{totalNodes}</span>
          <span className="stat-label">positions</span>
        </div>
        <div className="stat">
          <span className="stat-value">{totalMoves}</span>
          <span className="stat-label">moves</span>
        </div>
        <div className="stat">
          <span className="stat-value">{deepestDepth}</span>
          <span className="stat-label">depth</span>
        </div>
      </div>
      <Button variant="primary" onClick={onEdit}>
        Edit
      </Button>
    </div>
  );
}