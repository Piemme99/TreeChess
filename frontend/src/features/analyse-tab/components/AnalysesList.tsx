import { Button, Loading } from '../../../shared/components/UI';
import type { AnalysisSummary } from '../../../types';
import { formatDate } from '../utils/dateUtils';

export interface AnalysesListProps {
  analyses: AnalysisSummary[];
  loading: boolean;
  onDeleteClick: (id: string) => void;
  onViewClick: (id: string) => void;
}

export function AnalysesList({ analyses, loading, onDeleteClick, onViewClick }: AnalysesListProps) {
  if (loading) {
    return <Loading text="Loading analyses..." />;
  }

  if (analyses.length === 0) {
    return <p className="text-center text-text-muted p-8">No analyses yet. Upload a PGN file to get started.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {analyses.map((analysis) => (
        <div key={analysis.id} className="flex items-center justify-between p-4 bg-bg-card rounded-md shadow-sm">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="font-semibold mb-1">{analysis.filename}</h3>
              <p className="text-sm text-text-muted">
                {analysis.username} &middot;{' '}
                {analysis.gameCount} game{analysis.gameCount !== 1 ? 's' : ''} &middot;{' '}
                {formatDate(analysis.uploadedAt)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onViewClick(analysis.id)}
            >
              View
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => onDeleteClick(analysis.id)}
            >
              Delete
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
