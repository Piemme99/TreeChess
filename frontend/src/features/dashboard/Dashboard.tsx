import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepertoires } from '../repertoire/shared/hooks/useRepertoires';
import { useGames } from '../analyse-tab/hooks/useGames';
import { Loading, Button } from '../../shared/components/UI';
import { useAuthStore } from '../../stores/authStore';
import { EmptyRepertoireState } from './components/EmptyRepertoireState';
import { RepertoireOverview } from './components/RepertoireOverview';
import { RecentGames } from './components/RecentGames';

export function Dashboard() {
  const navigate = useNavigate();
  const { user, syncing, lastSyncResult } = useAuthStore();
  const { repertoires, loading: repLoading } = useRepertoires();
  const { games, loading: gamesLoading } = useGames();
  const [showSyncResult, setShowSyncResult] = useState(false);

  useEffect(() => {
    if (lastSyncResult) {
      const total = lastSyncResult.lichessGamesImported + lastSyncResult.chesscomGamesImported;
      if (total > 0) {
        setShowSyncResult(true);
        const timer = setTimeout(() => setShowSyncResult(false), 5000);
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

  if (repLoading && repertoires.length === 0) {
    return <Loading size="lg" text="Loading..." />;
  }

  if (repertoires.length === 0) {
    return (
      <div className="max-w-[960px] mx-auto w-full">
        <EmptyRepertoireState onRefresh={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="max-w-[960px] mx-auto w-full flex flex-col gap-8">
      {/* Sync status banners */}
      {syncing && (
        <div className="py-2 px-4 rounded-md text-sm text-center bg-info-light text-info">
          Syncing games...
        </div>
      )}
      {showSyncResult && !syncing && (
        <div className="py-2 px-4 rounded-md text-sm text-center bg-success-light text-success animate-sync-fade-out">
          {syncMessage()}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-xl font-semibold text-text">
          Welcome back{user?.username ? `, ${user.username}` : ''}
        </h1>
        <div className="flex items-center gap-3">
          <Button variant="primary" size="sm" onClick={() => navigate('/repertoires')}>
            New Repertoire
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/games')}>
            Import Games
          </Button>
        </div>
      </div>

      {/* Repertoire strip */}
      <RepertoireOverview repertoires={repertoires} />

      {/* Recent games table */}
      <RecentGames games={games} loading={gamesLoading} />
    </div>
  );
}
