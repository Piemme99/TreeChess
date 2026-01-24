import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAnalysisLoader } from './hooks/useAnalysisLoader';
import { useAddToRepertoire } from './hooks/useAddToRepertoire';
import { calculateStats, type GameStats } from './utils/gameAnalysisUtils';
import { GameSection } from './components/GameSection';
import { Button, Loading } from '../../components/UI';

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
      <div className="import-detail">
        <Loading size="lg" text="Loading analysis..." />
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <div className="import-detail">
      <header className="import-detail-header">
        <Button variant="ghost" onClick={() => navigate('/')}>
          &larr; Back
        </Button>
        <h1>Analysis Results</h1>
        <div className="header-spacer" />
      </header>

      <section className="analysis-overview">
        <div className="analysis-file-info">
          <span className="analysis-color-icon">♟</span>
          <div>
            <h2>{analysis.filename}</h2>
            <p>{analysis.gameCount} game{analysis.gameCount !== 1 ? 's' : ''} analyzed for {analysis.username}</p>
          </div>
        </div>

        <div className="stats-cards">
          <div className="stat-card stat-ok">
            <span className="stat-number">{stats.gamesAllOk}</span>
            <span className="stat-label">Games OK</span>
          </div>
          <div className="stat-card stat-error">
            <span className="stat-number">{stats.gamesWithErrors}</span>
            <span className="stat-label">Errors</span>
          </div>
          <div className="stat-card stat-new">
            <span className="stat-number">{stats.gamesWithNewLines}</span>
            <span className="stat-label">New Lines</span>
          </div>
        </div>
      </section>

      <section className="games-section">
        <h2>Games</h2>
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