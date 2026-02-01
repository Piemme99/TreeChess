import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useGames } from '../analyse-tab/hooks/useGames';
import { useFileUpload } from '../analyse-tab/hooks/useFileUpload';
import { useLichessImport } from '../analyse-tab/hooks/useLichessImport';
import { useChesscomImport } from '../analyse-tab/hooks/useChesscomImport';
import { useDeleteGame } from '../analyse-tab/hooks/useDeleteGame';
import { useInsights } from './hooks/useInsights';
import { GamesList } from '../analyse-tab/components/GamesList';
import { ImportPanel } from './components/ImportPanel';
import { WorstMistakes } from './components/WorstMistakes';
import { ConfirmModal, Button, EmptyState } from '../../shared/components/UI';
import { gamesApi } from '../../services/api';
import { toast } from '../../stores/toastStore';

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
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const [username, setUsername] = useState(() => authUser?.lichessUsername || authUser?.chesscomUsername || authUser?.username || '');
  const [showImport, setShowImport] = useState(false);
  const [timeClassFilter, setTimeClassFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [repertoireFilter, setRepertoireFilter] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [repertoiresList, setRepertoiresList] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<{ analysisId: string; gameIndex: number }[] | null>(null);

  const {
    games,
    loading,
    deleteGame,
    deleteGames,
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
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const handleImportSuccess = useCallback(() => {
    refresh();
    refreshInsights();
    setShowImport(false);
    gamesApi.repertoires().then(setRepertoiresList).catch(() => {});
  }, [refresh, refreshInsights]);

  const fileUploadState = useFileUpload(username, handleImportSuccess);
  const lichessImportState = useLichessImport(username, handleImportSuccess);
  const chesscomImportState = useChesscomImport(username, handleImportSuccess);
  const { deleteTarget, setDeleteTarget, deleting, handleDelete } = useDeleteGame(deleteGame);

  const handleViewClick = useCallback((analysisId: string, gameIndex: number) => {
    markGameViewed(analysisId, gameIndex);
    gamesApi.markViewed(analysisId, gameIndex).catch(() => {});
    navigate(`/analyse/${analysisId}/game/${gameIndex}`);
  }, [navigate, markGameViewed]);

  const handleDeleteClick = useCallback((analysisId: string, gameIndex: number) => {
    setDeleteTarget({ analysisId, gameIndex });
  }, [setDeleteTarget]);

  const handleBulkDelete = useCallback((items: { analysisId: string; gameIndex: number }[]) => {
    setBulkDeleteTargets(items);
  }, []);

  const confirmBulkDelete = useCallback(async () => {
    if (!bulkDeleteTargets) return;
    setBulkDeleting(true);
    try {
      const result = await gamesApi.bulkDelete(bulkDeleteTargets);
      deleteGames(bulkDeleteTargets);
      toast.success(`${result.deleted} game${result.deleted > 1 ? 's' : ''} deleted`);
      setBulkDeleteTargets(null);
      setSelectionMode(false);
    } catch {
      toast.error('Failed to delete games');
    } finally {
      setBulkDeleting(false);
    }
  }, [bulkDeleteTargets, deleteGames]);

  const hasGames = games.length > 0 || loading;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Games</h2>
        <Button
          variant={showImport ? 'secondary' : 'primary'}
          onClick={() => setShowImport(!showImport)}
        >
          {showImport ? 'Close' : 'Import Games'}
        </Button>
      </div>

      {showImport && (
        <ImportPanel
          username={username}
          onUsernameChange={setUsername}
          fileUploadState={fileUploadState}
          lichessImportState={lichessImportState}
          chesscomImportState={chesscomImportState}
        />
      )}

      {insights && (
        <WorstMistakes
          mistakes={insights.worstMistakes}
          engineAnalysisDone={insights.engineAnalysisDone}
          engineAnalysisTotal={insights.engineAnalysisTotal}
          engineAnalysisCompleted={insights.engineAnalysisCompleted}
        />
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {TIME_CLASS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              className={`py-1 px-4 rounded-full border text-sm cursor-pointer transition-all duration-150 ${
                timeClassFilter === filter.value
                  ? 'bg-primary border-primary text-white'
                  : 'border-border bg-transparent text-text-muted hover:border-primary hover:text-text'
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
                  : 'border-border bg-transparent text-text-muted hover:border-primary hover:text-text'
              }`}
              onClick={() => setSourceFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-[300px]">
          <select
            className="w-full py-2 px-4 border border-border rounded-md text-sm font-sans bg-bg-card text-text cursor-pointer appearance-auto focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary-light/20"
            value={repertoireFilter}
            onChange={(e) => setRepertoireFilter(e.target.value)}
          >
            <option value="">All repertoires</option>
            {repertoiresList.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {hasGames ? (
        <section>
          <GamesList
            games={games}
            loading={loading}
            onDeleteClick={handleDeleteClick}
            onBulkDelete={handleBulkDelete}
            onViewClick={handleViewClick}
            hasNextPage={hasNextPage}
            hasPrevPage={hasPrevPage}
            currentPage={currentPage}
            totalPages={totalPages}
            onNextPage={nextPage}
            onPrevPage={prevPage}
            selectionMode={selectionMode}
            onToggleSelectionMode={() => setSelectionMode((prev) => !prev)}
            onGameReanalyzed={refresh}
          />
        </section>
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

      <ConfirmModal
        isOpen={!!bulkDeleteTargets}
        onClose={() => setBulkDeleteTargets(null)}
        onConfirm={confirmBulkDelete}
        title="Delete Games"
        message={`Are you sure you want to delete ${bulkDeleteTargets?.length ?? 0} game${(bulkDeleteTargets?.length ?? 0) > 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText="Delete all"
        variant="danger"
        loading={bulkDeleting}
      />
    </div>
  );
}
