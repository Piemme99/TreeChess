import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAnalysisLoader } from './hooks/useAnalysisLoader';
import { useAddToRepertoire } from './hooks/useAddToRepertoire';
import { calculateStats, type GameStats } from './utils/gameAnalysisUtils';
import { GameSection } from './components/GameSection';
import { Button, Loading } from '../../shared/components/UI';

export function ImportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { analysis, loading } = useAnalysisLoader();
  const { handleAddToRepertoire } = useAddToRepertoire();

  const stats: GameStats = useMemo(() => {
    if (!analysis) return { totalGames: 0, gamesWithErrors: 0, gamesWithNewLines: 0, gamesAllOk: 0 };
    return calculateStats(analysis.results);
  }, [analysis]);

  if (loading) {
    return (
      <div className="max-w-[900px] mx-auto p-6">
        <Loading size="lg" text="Loading analysis..." />
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <div className="max-w-[900px] mx-auto p-6">
      <header className="flex items-center mb-8">
        <Button variant="ghost" onClick={() => navigate('/')}>
          &larr; Back
        </Button>
        <h1 className="flex-1 text-center text-2xl">Analysis Results</h1>
        <div />
      </header>

      <section className="bg-bg-card rounded-lg p-8 mb-8 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <span className="text-[2.5rem]">&#9823;</span>
          <div>
            <h2 className="text-xl mb-1">{analysis.filename}</h2>
            <p className="text-text-muted">{analysis.gameCount} game{analysis.gameCount !== 1 ? 's' : ''} analyzed for {analysis.username}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
          <div className="p-6 rounded-md text-center bg-success-light">
            <span className="block text-[2rem] font-bold text-success">{stats.gamesAllOk}</span>
            <span className="text-sm text-text-muted">Games OK</span>
          </div>
          <div className="p-6 rounded-md text-center bg-danger-light">
            <span className="block text-[2rem] font-bold text-danger">{stats.gamesWithErrors}</span>
            <span className="text-sm text-text-muted">Errors</span>
          </div>
          <div className="p-6 rounded-md text-center bg-warning-light">
            <span className="block text-[2rem] font-bold text-warning">{stats.gamesWithNewLines}</span>
            <span className="text-sm text-text-muted">New Lines</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4">Games</h2>
        {analysis.results.map((game, i) => (
          <GameSection
            key={i}
            game={game}
            gameNumber={i + 1}
            importId={id!}
            onAddToRepertoire={handleAddToRepertoire}
          />
        ))}
      </section>
    </div>
  );
}
