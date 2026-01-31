import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useGames } from './hooks/useGames';
import { useFileUpload } from './hooks/useFileUpload';
import { useLichessImport } from './hooks/useLichessImport';
import { useChesscomImport } from './hooks/useChesscomImport';
import { useDeleteGame } from './hooks/useDeleteGame';
import { ImportSection } from './components/ImportSection';
import { GamesList } from './components/GamesList';
import { ConfirmModal } from '../../shared/components/UI';

export function AnalyseTab() {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const [username, setUsername] = useState(() => authUser?.username || '');

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

  const [selectionMode, setSelectionMode] = useState(false);

  const handleDeleteClick = useCallback((analysisId: string, gameIndex: number) => {
    setDeleteTarget({ analysisId, gameIndex });
  }, [setDeleteTarget]);

  return (
    <div className="flex flex-col gap-8">
      <ImportSection
        username={username}
        onUsernameChange={setUsername}
        fileUploadState={fileUploadState}
        lichessImportState={lichessImportState}
        chesscomImportState={chesscomImportState}
      />

      <section>
        <h2 className="text-xl font-semibold mb-4 text-text-muted">Games</h2>
        <GamesList
          games={games}
          loading={loading}
          onDeleteClick={handleDeleteClick}
          onBulkDelete={() => {}}
          onViewClick={handleViewClick}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          currentPage={currentPage}
          totalPages={totalPages}
          onNextPage={nextPage}
          onPrevPage={prevPage}
          selectionMode={selectionMode}
          onToggleSelectionMode={() => setSelectionMode((prev) => !prev)}
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
