import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useRepertoires } from '../repertoire/shared/hooks/useRepertoires';
import { useGames } from '../analyse-tab/hooks/useGames';
import { Loading, Button } from '../../shared/components/UI';
import { useAuthStore } from '../../stores/authStore';
import { EmptyRepertoireState } from './components/EmptyRepertoireState';
import { RepertoireOverview } from './components/RepertoireOverview';
import { RecentGames } from './components/RecentGames';
import { StatsSummary } from './components/StatsSummary';
import { RepertoireHealth } from './components/RepertoireHealth';
import { WeakSpots } from './components/WeakSpots';
import { useDashboardStats } from './hooks/useDashboardStats';
import { useInsights } from '../games/hooks/useInsights';
import { fadeUp, staggerContainer } from '../../shared/utils/animations';

export function Dashboard() {
  const navigate = useNavigate();
  const { user, syncing, lastSyncResult } = useAuthStore();
  const { repertoires, loading: repLoading } = useRepertoires();
  const { games, loading: gamesLoading } = useGames();
  const { stats } = useDashboardStats();
  const { insights } = useInsights();
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

  const hasAnalyzedGames = stats && stats.totalGames > 0;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="max-w-[960px] mx-auto w-full flex flex-col gap-8"
    >
      {/* Sync status banners */}
      {syncing && (
        <motion.div variants={fadeUp} custom={0} className="py-2 px-4 rounded-xl text-sm text-center bg-info-light text-info">
          Syncing games...
        </motion.div>
      )}
      {showSyncResult && !syncing && (
        <motion.div variants={fadeUp} custom={0} className="py-2 px-4 rounded-xl text-sm text-center bg-success-light text-success animate-sync-fade-out">
          {syncMessage()}
        </motion.div>
      )}

      {/* Header row */}
      <motion.div variants={fadeUp} custom={0} className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-xl font-semibold text-text font-display">
          Welcome back{user?.username ? <>, <span className="bg-gradient-to-r from-primary to-primary-hover bg-clip-text text-transparent">{user.username}</span></> : ''}
        </h1>
        <div className="flex items-center gap-3">
          <Button variant="primary" size="sm" onClick={() => navigate('/repertoires')}>
            New Repertoire
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/games')}>
            Import Games
          </Button>
        </div>
      </motion.div>

      {/* Stats summary */}
      {hasAnalyzedGames && (
        <motion.div variants={fadeUp} custom={1}>
          <StatsSummary stats={stats} />
        </motion.div>
      )}

      {/* Repertoire strip */}
      <motion.div variants={fadeUp} custom={hasAnalyzedGames ? 2 : 1}>
        <RepertoireOverview repertoires={repertoires} />
      </motion.div>

      {/* Repertoire health */}
      {hasAnalyzedGames && stats.repertoires.length > 0 && (
        <motion.div variants={fadeUp} custom={3}>
          <RepertoireHealth repertoires={stats.repertoires} />
        </motion.div>
      )}

      {/* Weak spots */}
      {hasAnalyzedGames && insights && (
        <motion.div variants={fadeUp} custom={4}>
          <WeakSpots insights={insights} />
        </motion.div>
      )}

      {/* Recent games table */}
      <motion.div variants={fadeUp} custom={hasAnalyzedGames ? 5 : 2}>
        <RecentGames games={games} loading={gamesLoading} />
      </motion.div>
    </motion.div>
  );
}
