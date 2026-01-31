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
    <section className="mb-8">
      {syncing && (
        <div className="py-2 px-4 rounded-md text-[0.8125rem] mb-4 text-center bg-info-light text-info">
          Syncing games...
        </div>
      )}
      {showResult && !syncing && (
        <div className="py-2 px-4 rounded-md text-[0.8125rem] mb-4 text-center bg-success-light text-success animate-sync-fade-out">
          {syncMessage()}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <button
          className="flex flex-col items-center p-6 bg-bg-card border border-border rounded-lg cursor-pointer transition-all duration-150 text-center font-sans hover:border-primary hover:shadow-md"
          onClick={() => navigate('/games')}
        >
          <span className="text-[2rem] mb-2 leading-none">&#128203;</span>
          <span className="font-semibold mb-1">Import Games</span>
          <span className="text-[0.8125rem] text-text-muted">From Lichess, Chess.com or PGN</span>
        </button>
        <button
          className="flex flex-col items-center p-6 bg-bg-card border border-border rounded-lg cursor-pointer transition-all duration-150 text-center font-sans hover:border-primary hover:shadow-md"
          onClick={() => navigate('/repertoires')}
        >
          <span className="text-[2rem] mb-2 leading-none">&#43;</span>
          <span className="font-semibold mb-1">Create Repertoire</span>
          <span className="text-[0.8125rem] text-text-muted">Build your opening playbook</span>
        </button>
      </div>
    </section>
  );
}
