import { Button, Loading } from '../../../components/UI';
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
    return <p className="no-analyses">No analyses yet. Upload a PGN file to get started.</p>;
  }

  return (
    <div className="analyses-list">
      {analyses.map((analysis) => (
        <div key={analysis.id} className="analysis-card">
          <div className="analysis-info">
            <div className="analysis-details">
              <h3 className="analysis-filename">{analysis.filename}</h3>
              <p className="analysis-meta">
                {analysis.username} &middot;{' '}
                {analysis.gameCount} game{analysis.gameCount !== 1 ? 's' : ''} &middot;{' '}
                {formatDate(analysis.uploadedAt)}
              </p>
            </div>
          </div>
          <div className="analysis-actions">
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