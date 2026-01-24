import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/UI';
import { getFirstActionableMove } from '../utils/gameAnalysisUtils';
import type { GameAnalysis, MoveAnalysis } from '../../../types';

export interface GameSectionProps {
  game: GameAnalysis;
  gameNumber: number;
  importId: string;
  onAddToRepertoire: (move: MoveAnalysis, game: GameAnalysis) => void;
}

export function GameSection({ game, gameNumber, importId, onAddToRepertoire }: GameSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const firstActionable = getFirstActionableMove(game);
  const hasIssues = firstActionable !== null;

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