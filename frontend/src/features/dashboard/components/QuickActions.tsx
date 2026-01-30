import { useNavigate } from 'react-router-dom';

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <section className="dashboard-section">
      <div className="quick-actions">
        <button className="quick-action-card" onClick={() => navigate('/games')}>
          <span className="quick-action-icon">&#128203;</span>
          <span className="quick-action-label">Import Games</span>
          <span className="quick-action-desc">From Lichess, Chess.com or PGN</span>
        </button>
        <button className="quick-action-card" onClick={() => navigate('/repertoires')}>
          <span className="quick-action-icon">&#127909;</span>
          <span className="quick-action-label">Import from YouTube</span>
          <span className="quick-action-desc">Extract openings from a video</span>
        </button>
        <button className="quick-action-card" onClick={() => navigate('/repertoires')}>
          <span className="quick-action-icon">&#43;</span>
          <span className="quick-action-label">Create Repertoire</span>
          <span className="quick-action-desc">Build your opening playbook</span>
        </button>
      </div>
    </section>
  );
}
