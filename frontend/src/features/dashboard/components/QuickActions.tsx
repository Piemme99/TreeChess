import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';

export function QuickActions() {
  const navigate = useNavigate();
  const { syncing, lastSyncResult } = useAuthStore();
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (lastSyncResult) {
      const total = lastSyncResult.lichessGamesImported + lastSyncResult.chesscomGamesImported;
      if (total > 0) {
        setShowResult(true);
        const timer = setTimeout(() => setShowResult(false), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [lastSyncResult]);

  const syncMessage = () => {
    if (!lastSyncResult) return '';
    const total = lastSyncResult.lichessGamesImported + lastSyncResult.chesscomGamesImported;
    if (total === 0) return '';
    return `${total} new game${total > 1 ? 's' : ''} imported`;
  };

  return (
    <section className="dashboard-section">
      {syncing && (
        <div className="sync-status sync-status--active">
          Syncing games...
        </div>
      )}
      {showResult && !syncing && (
        <div className="sync-status sync-status--done">
          {syncMessage()}
        </div>
      )}
      <div className="quick-actions">
        <button className="quick-action-card" onClick={() => navigate('/games')}>
          <span className="quick-action-icon">&#128203;</span>
          <span className="quick-action-label">Import Games</span>
          <span className="quick-action-desc">From Lichess, Chess.com or PGN</span>
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
