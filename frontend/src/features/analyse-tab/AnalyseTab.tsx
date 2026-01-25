import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usernameStorage } from '../../services/api';
import { useGames } from './hooks/useGames';
import { useFileUpload } from './hooks/useFileUpload';
import { useDeleteGame } from './hooks/useDeleteGame';
import { ImportSection } from './components/ImportSection';
import { GamesList } from './components/GamesList';
import { ConfirmModal } from '../../shared/components/UI';

export function AnalyseTab() {
  const navigate = useNavigate();
  const [username, setUsername] = useState(() => usernameStorage.get());

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
  const { deleteTarget, setDeleteTarget, deleting, handleDelete } = useDeleteGame(deleteGame);

  const handleViewClick = useCallback((analysisId: string, gameIndex: number) => {
    navigate(`/analyse/${analysisId}/game/${gameIndex}`);
  }, [navigate]);

  const handleDeleteClick = useCallback((analysisId: string, gameIndex: number) => {
    setDeleteTarget({ analysisId, gameIndex });
  }, [setDeleteTarget]);

  return (
    <div className="analyse-tab">
      <ImportSection
        username={username}
        onUsernameChange={setUsername}
        fileUploadState={fileUploadState}
      />

      <section className="analyses-section">
        <h2>Games</h2>
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
