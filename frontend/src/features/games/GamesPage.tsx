import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useGames } from '../analyse-tab/hooks/useGames';
import { useFileUpload } from '../analyse-tab/hooks/useFileUpload';
import { useLichessImport } from '../analyse-tab/hooks/useLichessImport';
import { useChesscomImport } from '../analyse-tab/hooks/useChesscomImport';
import { useDeleteGame } from '../analyse-tab/hooks/useDeleteGame';
import { GamesList } from '../analyse-tab/components/GamesList';
import { ImportPanel } from './components/ImportPanel';
import { ConfirmModal, Button, EmptyState } from '../../shared/components/UI';

export function GamesPage() {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const [username, setUsername] = useState(() => authUser?.username || '');
  const [showImport, setShowImport] = useState(false);

  const {
    games,
    loading,
    deleteGame,
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage,
    currentPage,
    totalPages,
    refresh
  } = useGames();

  const fileUploadState = useFileUpload(username, refresh);
  const lichessImportState = useLichessImport(username, refresh);
  const chesscomImportState = useChesscomImport(username, refresh);
  const { deleteTarget, setDeleteTarget, deleting, handleDelete } = useDeleteGame(deleteGame);

  const handleViewClick = useCallback((analysisId: string, gameIndex: number) => {
    navigate(`/analyse/${analysisId}/game/${gameIndex}`);
  }, [navigate]);

  const handleDeleteClick = useCallback((analysisId: string, gameIndex: number) => {
    setDeleteTarget({ analysisId, gameIndex });
  }, [setDeleteTarget]);

  const hasGames = games.length > 0 || loading;

  return (
    <div className="games-page">
      <div className="games-page-header">
        <h2>Games</h2>
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

      {hasGames ? (
        <section className="analyses-section">
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
    </div>
  );
}
