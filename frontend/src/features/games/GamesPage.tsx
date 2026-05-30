import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { useGames } from '../analyse-tab/hooks/useGames';
import { useFileUpload } from '../analyse-tab/hooks/useFileUpload';
import { useLichessImport } from '../analyse-tab/hooks/useLichessImport';
import { useChesscomImport } from '../analyse-tab/hooks/useChesscomImport';
import { useInsights } from './hooks/useInsights';
import type { RepertoireFilterOption } from '../../types';
import { GamesList } from '../analyse-tab/components/GamesList';
import { ImportPanel } from './components/ImportPanel';
import { MistakesList } from '../../shared/components/MistakesList';
import { Button, EmptyState } from '../../shared/components/UI';
import { gamesApi } from '../../services/api';
import { toast } from '../../stores/toastStore';
import { fadeUp } from '../../shared/utils/animations';
import { usePageTitle } from '../../shared/hooks/usePageTitle';
import { useReanalysisCompletion } from '../../shared/hooks';

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
    markGameViewed,
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage,
    currentPage,
    totalPages,
    refresh
  } = useGames(timeClassFilter || undefined, repertoireFilter || undefined, sourceFilter || undefined);

  const { insights, error: insightsError, refresh: refreshInsights } = useInsights();

  useReanalysisCompletion(useCallback(() => {
    refresh();
    refreshInsights();
  }, [refresh, refreshInsights]));

  // useInsights polls while analysis is in progress, so toast only on the
  // transition into an error state rather than on every poll tick.
  const prevInsightsError = useRef<string | null>(null);
  useEffect(() => {
    if (insightsError && !prevInsightsError.current) {
      toast.error(insightsError);
    }
    prevInsightsError.current = insightsError;
  }, [insightsError]);

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

  const handleViewClick = useCallback((analysisId: string, gameIndex: number) => {
    markGameViewed(analysisId, gameIndex);
    gamesApi.markViewed(analysisId, gameIndex).catch(() => { /* non-critical */ });
    navigate(`/analyse/${analysisId}/game/${gameIndex}`, { state: { from: location.pathname } });
  }, [navigate, markGameViewed, location]);

  const [reanalyzingAll, setReanalyzingAll] = useState(false);
  // True while any per-row reanalyze is in flight (reported by GamesList); used
  // to lock the bulk "re-analyze all" action so the two can't run concurrently.
  const [rowReanalyzing, setRowReanalyzing] = useState(false);

  const handleReanalyzeAll = useCallback(async () => {
    if (reanalyzingAll || rowReanalyzing) return;
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
  }, [refresh, refreshInsights, reanalyzingAll, rowReanalyzing]);

  const hasGames = games.length > 0 || loading;

  return (
    <div className="max-w-[1200px] mx-auto w-full">
    <div className="flex flex-col gap-6">
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Games</h2>
        <Button
          variant={showImport ? 'secondary' : 'primary'}
          onClick={() => setShowImport(!showImport)}
        >
          {showImport ? 'Close' : 'Import Games'}
        </Button>
      </motion.div>

      {showImport && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
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
        <MistakesList
          insights={insights}
          title="Worst Opening Mistakes"
          onDismiss={handleDismissMistake}
        />
      )}

      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="flex items-center gap-4 flex-wrap">
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
            disabled={reanalyzingAll || rowReanalyzing || loading}
          >
            {reanalyzingAll ? 'Re-analyzing...' : 'Re-analyze all'}
          </Button>
        </div>
      </motion.div>

      {hasGames ? (
        <motion.section variants={fadeUp} initial="hidden" animate="visible" custom={3}>
          <GamesList
            games={games}
            loading={loading}
            onViewClick={handleViewClick}
            hasNextPage={hasNextPage}
            hasPrevPage={hasPrevPage}
            currentPage={currentPage}
            totalPages={totalPages}
            onNextPage={nextPage}
            onPrevPage={prevPage}
            onGameReanalyzed={refresh}
            reanalyzeAllActive={reanalyzingAll}
            onReanalyzingChange={setRowReanalyzing}
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

    </div>
    </div>
  );
}
