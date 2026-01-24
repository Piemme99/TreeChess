import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { importApi } from '../../services/api';
import { toast } from '../../stores/toastStore';
import { Button, Loading } from '../UI';
import type { AnalysisDetail, GameAnalysis, MoveAnalysis } from '../../types';

interface SummaryStats {
  totalGames: number;
  gamesWithErrors: number;
  gamesWithNewLines: number;
  gamesAllOk: number;
}

// Find the first actionable move in a game (opponent-new or out-of-repertoire)
function getFirstActionableMove(game: GameAnalysis): MoveAnalysis | null {
  return game.moves.find(
    (m) => m.status === 'opponent-new' || m.status === 'out-of-repertoire'
  ) || null;
}

function calculateStats(results: GameAnalysis[]): SummaryStats {
  let gamesWithErrors = 0;
  let gamesWithNewLines = 0;
  let gamesAllOk = 0;

  for (const game of results) {
    const firstActionable = getFirstActionableMove(game);

    if (!firstActionable) {
      gamesAllOk++;
    } else if (firstActionable.status === 'out-of-repertoire') {
      gamesWithErrors++;
    } else if (firstActionable.status === 'opponent-new') {
      gamesWithNewLines++;
    }
  }

  return {
    totalGames: results.length,
    gamesWithErrors,
    gamesWithNewLines,
    gamesAllOk
  };
}

interface GameSectionProps {
  game: GameAnalysis;
  gameNumber: number;
  importId: string;
  onAddToRepertoire: (move: MoveAnalysis, game: GameAnalysis) => void;
}

function GameSection({ game, gameNumber, importId, onAddToRepertoire }: GameSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const firstActionable = getFirstActionableMove(game);
  const hasIssues = firstActionable !== null;

  // For the detailed view, keep all errors and new lines
  const errors = game.moves.filter((m) => m.status === 'out-of-repertoire');
  const newLines = game.moves.filter((m) => m.status === 'opponent-new');

  const opponent = game.headers.White && game.headers.Black
    ? `${game.headers.White} vs ${game.headers.Black}`
    : 'Unknown players';

  const result = game.headers.Result || '*';

  return (
    <div className={`game-section ${hasIssues ? 'has-issues' : ''}`}>
      <div
        className="game-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="game-info">
          <span className="game-number">Game {gameNumber}</span>
          <span className="game-players">{opponent}</span>
          <span className="game-result">{result}</span>
        </div>
        <div className="game-badges">
          {firstActionable?.status === 'out-of-repertoire' && (
            <span className="badge badge-error">Error</span>
          )}
          {firstActionable?.status === 'opponent-new' && (
            <span className="badge badge-new">New line</span>
          )}
          {!hasIssues && (
            <span className="badge badge-ok">All in repertoire</span>
          )}
        </div>
        <Button
          variant="primary"
          size="sm"
          className="view-analysis-btn"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/analyse/${importId}/game/${gameNumber - 1}`);
          }}
        >
          Analyze
        </Button>
        <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className="game-details">
          {errors.length > 0 && (
            <div className="move-group">
              <h4 className="move-group-title error">Out of Repertoire (Your Errors)</h4>
              {errors.map((move, i) => (
                <div key={i} className="move-item error">
                  <span className="move-ply">
                    {Math.floor(move.plyNumber / 2) + 1}{move.plyNumber % 2 === 0 ? '.' : '...'}
                  </span>
                  <span className="move-san">{move.san}</span>
                  {move.expectedMove && (
                    <span className="move-expected">
                      Expected: <strong>{move.expectedMove}</strong>
                    </span>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onAddToRepertoire(move, game)}
                  >
                    Add to Repertoire
                  </Button>
                </div>
              ))}
            </div>
          )}

          {newLines.length > 0 && (
            <div className="move-group">
              <h4 className="move-group-title new">New Opponent Lines</h4>
              {newLines.map((move, i) => (
                <div key={i} className="move-item new">
                  <span className="move-ply">
                    {Math.floor(move.plyNumber / 2) + 1}{move.plyNumber % 2 === 0 ? '.' : '...'}
                  </span>
                  <span className="move-san">{move.san}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onAddToRepertoire(move, game)}
                  >
                    Prepare Response
                  </Button>
                </div>
              ))}
            </div>
          )}

          {!hasIssues && (
            <p className="all-ok-message">All moves were in your repertoire!</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ImportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalysis = async () => {
      if (!id) {
        navigate('/');
        return;
      }

      try {
        const data = await importApi.get(id);
        setAnalysis(data);
      } catch {
        toast.error('Failed to load analysis');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    loadAnalysis();
  }, [id, navigate]);

  const stats = useMemo(() => {
    if (!analysis) return { totalGames: 0, gamesWithErrors: 0, gamesWithNewLines: 0, gamesAllOk: 0 };
    return calculateStats(analysis.results);
  }, [analysis]);

  const handleAddToRepertoire = useCallback((move: MoveAnalysis, game: GameAnalysis) => {
    if (!game.userColor) return;

    // Store context in sessionStorage for the repertoire edit page
    // Using spec-defined key: pendingAddNode
    const context = {
      color: game.userColor,
      fen: move.fen,
      moveSAN: move.san,
      gameInfo: `${game.headers.White || '?'} vs ${game.headers.Black || '?'}`
    };
    sessionStorage.setItem('pendingAddNode', JSON.stringify(context));

    // Navigate to repertoire edit page
    navigate(`/repertoire/${game.userColor}/edit`);
    toast.info(`Navigate to position and add "${move.san}"`);
  }, [navigate]);

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
