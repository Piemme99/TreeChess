import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAuthStore } from '../../stores/authStore';
import { useGames } from './hooks/useGames';
import { useFileUpload } from './hooks/useFileUpload';
import { useLichessImport } from './hooks/useLichessImport';
import { useChesscomImport } from './hooks/useChesscomImport';
import { ImportSection } from './components/ImportSection';
import { GamesList } from './components/GamesList';

export function AnalyseTab() {
  const navigate = useNavigate();
  const location = useLocation();
  const authUser = useAuthStore((s) => s.user);
  const [username, setUsername] = useState(() => authUser?.username || '');

  const {
    games,
    loading,
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

  const handleViewClick = useCallback((analysisId: string, gameIndex: number) => {
    navigate(`/analyse/${analysisId}/game/${gameIndex}`, { state: { from: location.pathname } });
  }, [navigate, location]);

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
          onViewClick={handleViewClick}
          hasNextPage={hasNextPage}
          hasPrevPage={hasPrevPage}
          currentPage={currentPage}
          totalPages={totalPages}
          onNextPage={nextPage}
          onPrevPage={prevPage}
        />
      </section>
    </div>
  );
}
