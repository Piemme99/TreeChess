import { memo } from 'react';
import { Button } from '../../../../shared/components/UI';
import type { Color } from '../../../../types';

export interface RepertoireCardProps {
  color: Color;
  totalMoves: number;
  totalNodes: number;
  deepestDepth: number;
  onEdit: () => void;
}

export const RepertoireCard = memo(function RepertoireCard({ color, totalMoves, totalNodes, deepestDepth, onEdit }: RepertoireCardProps) {
  const isWhite = color === 'white';

  return (
    <div className={`bg-bg-card rounded-lg p-8 shadow-md text-center transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg ${isWhite ? 'border-t-4 border-t-[#f5f5f5]' : 'border-t-4 border-t-[#333]'}`}>
      <div className="text-5xl mb-4">
        {isWhite ? '\u2654' : '\u265A'}
      </div>
      <h3 className="text-2xl font-semibold mb-4">
        {isWhite ? 'White' : 'Black'} Repertoire
      </h3>
      <div className="flex justify-center gap-8 mb-6">
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-primary">{totalNodes}</span>
          <span className="text-sm text-text-muted">positions</span>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-primary">{totalMoves}</span>
          <span className="text-sm text-text-muted">moves</span>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-primary">{deepestDepth}</span>
          <span className="text-sm text-text-muted">depth</span>
        </div>
      </div>
      <Button variant="primary" onClick={onEdit}>
        Edit
      </Button>
    </div>
  );
});
