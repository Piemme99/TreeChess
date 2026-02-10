import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useGames } from '../analyse-tab/hooks/useGames';
import { useFileUpload } from '../analyse-tab/hooks/useFileUpload';
import { useLichessImport } from '../analyse-tab/hooks/useLichessImport';
import { useChesscomImport } from '../analyse-tab/hooks/useChesscomImport';
import { useDeleteGame } from '../analyse-tab/hooks/useDeleteGame';
import { useInsights } from './hooks/useInsights';
import type { RepertoireFilterOption } from '../../types';
import { GamesList } from '../analyse-tab/components/GamesList';
import { ImportPanel } from './components/ImportPanel';
import { WorstMistakes } from './components/WorstMistakes';
import { ConfirmModal, Button, EmptyState } from '../../shared/components/UI';
import { gamesApi } from '../../services/api';
import { toast } from '../../stores/toastStore';
import { fadeUp, staggerContainer } from '../../shared/utils/animations';
import { usePageTitle } from '../../shared/hooks/usePageTitle';

const TIME_CLASS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'bullet', label: 'Bullet' },
  { value: 'blitz', label: 'Blitz' },
  { value: 'rapid', label: 'Rapid' },
  { value: 'daily', label: 'Daily' },
] as const;

const SOURCE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'lichess', label: 'Lichess' },
  { value: 'chesscom', label: 'Chess.com' },
  { value: 'pgn', label: 'PGN' },
] as const;

export function GamesPage() {
  usePageTitle('Games');
  const navigate = useNavigate();
  const location = useLocation();
  const authUser = useAuthStore((s) => s.user);
  const [username, setUsername] = useState(() => authUser?.lichessUsername || authUser?.chesscomUsername || authUser?.username || '');
  const [showImport, setShowImport] = useState(false);
  const [timeClassFilter, setTimeClassFilter] = useState(() => sessionStorage.getItem('games-timeClass') || '');
  const [sourceFilter, setSourceFilter] = useState(() => sessionStorage.getItem('games-source') || '');
  const [repertoireFilter, setRepertoireFilter] = useState(() => sessionStorage.getItem('games-repertoireId') || '');
  const [repertoiresList, setRepertoiresList] = useState<RepertoireFilterOption[]>([]);

  useEffect(() => { sessionStorage.setItem('games-timeClass', timeClassFilter); }, [timeClassFilter]);
  useEffect(() => { sessionStorage.setItem('games-source', sourceFilter); }, [sourceFilter]);
  useEffect(() => { sessionStorage.setItem('games-repertoireId', repertoireFilter); }, [repertoireFilter]);

  const {
    games,
    loading,
    deleteGame,
    markGameViewed,
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage,
    currentPage,
    totalPages,
    refresh
  } = useGames(timeClassFilter || undefined, repertoireFilter || undefined, sourceFilter || undefined);

  const { insights, refresh: refreshInsights } = useInsights();

  useEffect(() => {
    const controller = new AbortController();
    gamesApi.repertoires({ signal: controller.signal })
      .then(setRepertoiresList)
      .catch((err) => {
        if (err?.code !== 'ERR_CANCELED') toast.error('Failed to load repertoire filters');
      });
    return () => controller.abort();
  }, []);

  const handleImportSuccess = useCallback(() => {
    refresh();
    refreshInsights();
    setShowImport(false);
    gamesApi.repertoires().then(setRepertoiresList).catch(() => toast.error('Failed to refresh repertoire filters'));
  }, [refresh, refreshInsights]);

  const handleDismissMistake = useCallback(async (fen: string, playedMove: string) => {
    try {
      await gamesApi.dismissMistake(fen, playedMove);
      refreshInsights();
    } catch {
      toast.error('Failed to dismiss mistake');
    }
  }, [refreshInsights]);

  const fileUploadState = useFileUpload(username, handleImportSuccess);
  const lichessImportState = useLichessImport(username, handleImportSuccess);
  const chesscomImportState = useChesscomImport(username, handleImportSuccess);
  const { deleteTarget, setDeleteTarget, deleting, handleDelete } = useDeleteGame(deleteGame);

  const handleViewClick = useCallback((analysisId: string, gameIndex: number) => {
    markGameViewed(analysisId, gameIndex);
    gamesApi.markViewed(analysisId, gameIndex).catch(() => { /* non-critical */ });
    navigate(`/analyse/${analysisId}/game/${gameIndex}`, { state: { from: location.pathname } });
  }, [navigate, markGameViewed, location]);

  const handleDeleteClick = useCallback((analysisId: string, gameIndex: number) => {
    setDeleteTarget({ analysisId, gameIndex });
  }, [setDeleteTarget]);

  const [reanalyzingAll, setReanalyzingAll] = useState(false);

  const handleReanalyzeAll = useCallback(async () => {
    setReanalyzingAll(true);
    try {
      const result = await gamesApi.reanalyzeAll();
      toast.success(`Re-analyzed ${result.reanalyzed} games against current repertoires`);
      refresh();
      refreshInsights();
      gamesApi.repertoires().then(setRepertoiresList).catch(() => toast.error('Failed to refresh repertoire filters'));
    } catch {
      toast.error('Failed to re-analyze games');
    } finally {
      setReanalyzingAll(false);
    }
  }, [refresh, refreshInsights]);

  const hasGames = games.length > 0 || loading;

  return (
    <div className="max-w-[1200px] mx-auto w-full">
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col gap-6">
      <motion.div variants={fadeUp} custom={0} className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Games</h2>
        <Button
          variant={showImport ? 'secondary' : 'primary'}
          onClick={() => setShowImport(!showImport)}
        >
          {showImport ? 'Close' : 'Import Games'}
        </Button>
      </motion.div>

      {showImport && (
        <motion.div variants={fadeUp} custom={1}>
        <ImportPanel
          username={username}
          onUsernameChange={setUsername}
          fileUploadState={fileUploadState}
          lichessImportState={lichessImportState}
          chesscomImportState={chesscomImportState}
        />
        </motion.div>
      )}

      {insights && (
        <WorstMistakes
          mistakes={insights.worstMistakes}
          engineAnalysisDone={insights.engineAnalysisDone}
          engineAnalysisTotal={insights.engineAnalysisTotal}
          engineAnalysisCompleted={insights.engineAnalysisCompleted}
          onDismiss={handleDismissMistake}
        />
      )}

      <motion.div variants={fadeUp} custom={2} className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {TIME_CLASS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              className={`py-1 px-4 rounded-full border text-sm cursor-pointer transition-all duration-150 ${
                timeClassFilter === filter.value
                  ? 'bg-primary border-primary text-white'
                  : 'border-primary/15 bg-transparent text-text-muted hover:border-primary hover:text-text'
              }`}
              onClick={() => setTimeClassFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {SOURCE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              className={`py-1 px-4 rounded-full border text-sm cursor-pointer transition-all duration-150 ${
                sourceFilter === filter.value
                  ? 'bg-primary border-primary text-white'
                  : 'border-primary/15 bg-transparent text-text-muted hover:border-primary hover:text-text'
              }`}
              onClick={() => setSourceFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-[300px]">
          <select
            className="w-full py-2 px-4 border border-primary/15 rounded-xl text-sm font-sans bg-bg-card text-text cursor-pointer appearance-auto focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light/20"
            value={repertoireFilter}
            onChange={(e) => setRepertoireFilter(e.target.value)}
          >
            <option value="">All repertoires</option>
            {repertoiresList.map((rep) => (
              <option key={rep.id} value={rep.id}>
                {rep.name} ({rep.color === 'white' ? 'White' : 'Black'})
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReanalyzeAll}
            disabled={reanalyzingAll || loading}
          >
            {reanalyzingAll ? 'Re-analyzing...' : 'Re-analyze all'}
          </Button>
        </div>
      </motion.div>

      {hasGames ? (
        <motion.section variants={fadeUp} custom={3}>
          <GamesList
            games={games}
            loading={loading}
            onDeleteClick={handleDeleteClick}
            onViewClick={handleViewClick}
            hasNextPage={hasNextPage}
            hasPrevPage={hasPrevPage}
            currentPage={currentPage}
            totalPages={totalPages}
            onNextPage={nextPage}
            onPrevPage={prevPage}
            onGameReanalyzed={refresh}
          />
        </motion.section>
      ) : (
        <EmptyState
          icon="&#9823;"
          title="No games imported yet"
          description="Import your games to see how they compare to your repertoire."
        >
          <Button variant="primary" onClick={() => setShowImport(true)}>
            Import from Lichess
          </Button>
          <Button variant="secondary" onClick={() => setShowImport(true)}>
            Chess.com
          </Button>
          <Button variant="ghost" onClick={() => setShowImport(true)}>
            PGN file
          </Button>
        </EmptyState>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Game"
        message="Are you sure you want to delete this game? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />

    </motion.div>
    </div>
  );
}
