import { useNavigate } from 'react-router-dom';
import type { Repertoire } from '../../../types';

interface RepertoireOverviewProps {
  repertoires: Repertoire[];
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function RepertoireCard({ repertoire }: { repertoire: Repertoire }) {
  const navigate = useNavigate();
  const isWhite = repertoire.color === 'white';

  return (
    <button
      className="flex-shrink-0 w-48 bg-bg-card border border-border rounded-lg p-4 cursor-pointer transition-all duration-150 text-left font-sans hover:border-primary hover:shadow-md group"
      onClick={() => navigate(`/repertoire/${repertoire.id}/edit`)}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg leading-none">{isWhite ? '\u2654' : '\u265A'}</span>
        <span className="font-semibold text-sm text-text truncate">{repertoire.name}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>{repertoire.metadata.totalMoves} moves</span>
        <span>{formatDate(repertoire.updatedAt)}</span>
      </div>
    </button>
  );
}

function AddRepertoireCard() {
  const navigate = useNavigate();

  return (
    <button
      className="flex-shrink-0 w-48 bg-bg-card border border-dashed border-border-dark rounded-lg p-4 cursor-pointer transition-all duration-150 font-sans hover:border-primary hover:bg-primary-light flex flex-col items-center justify-center gap-2"
      onClick={() => navigate('/repertoires')}
    >
      <span className="text-2xl text-text-muted leading-none">+</span>
      <span className="text-sm text-text-muted font-medium">New Repertoire</span>
    </button>
  );
}

export function RepertoireOverview({ repertoires }: RepertoireOverviewProps) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">Your Repertoires</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {repertoires.map((rep) => (
          <RepertoireCard key={rep.id} repertoire={rep} />
        ))}
        <AddRepertoireCard />
      </div>
    </section>
  );
}
