import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/components/UI';
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
    <div className="bg-bg-card rounded-md mb-2 shadow-sm overflow-hidden">
      <div
        className="flex items-center p-4 cursor-pointer transition-colors duration-150 hover:bg-bg"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 flex items-center gap-4">
          <span className="font-semibold">Game {gameNumber}</span>
          <span className="text-text-muted">{opponent}</span>
          <span className="font-mono font-medium">{result}</span>
        </div>
        <div className="flex gap-2">
          {firstActionable?.status === 'out-of-repertoire' && (
            <span className="py-1 px-2 rounded-full text-xs font-medium bg-danger-light text-danger">Opening error</span>
          )}
          {firstActionable?.status === 'opponent-new' && (
            <span className="py-1 px-2 rounded-full text-xs font-medium bg-warning-light text-warning">New line</span>
          )}
          {!hasIssues && (
            <span className="py-1 px-2 rounded-full text-xs font-medium bg-success-light text-success">All in repertoire</span>
          )}
        </div>
        <Button
          variant="primary"
          size="sm"
          className="ml-auto mr-2"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/analyse/${importId}/game/${gameNumber - 1}`);
          }}
        >
          Analyze
        </Button>
        <span className="text-text-muted ml-2">{expanded ? '\u25BC' : '\u25B6'}</span>
      </div>

      {expanded && (
        <div className="p-4 border-t border-border bg-bg">
          {errors.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2 py-1 px-2 rounded-sm bg-danger-light text-danger">Out of Repertoire (Your Errors)</h4>
              {errors.map((move, i) => (
                <div key={i} className="flex items-center gap-4 p-2 bg-bg-card rounded-sm mb-1">
                  <span className="font-mono text-text-muted min-w-[40px]">
                    {Math.floor(move.plyNumber / 2) + 1}{move.plyNumber % 2 === 0 ? '.' : '...'}
                  </span>
                  <span className="font-mono font-semibold">{move.san}</span>
                  {move.expectedMove && (
                    <span className="flex-1 text-text-muted text-sm">
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
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2 py-1 px-2 rounded-sm bg-warning-light text-warning">New Opponent Lines</h4>
              {newLines.map((move, i) => (
                <div key={i} className="flex items-center gap-4 p-2 bg-bg-card rounded-sm mb-1">
                  <span className="font-mono text-text-muted min-w-[40px]">
                    {Math.floor(move.plyNumber / 2) + 1}{move.plyNumber % 2 === 0 ? '.' : '...'}
                  </span>
                  <span className="font-mono font-semibold">{move.san}</span>
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
            <p className="text-center text-success font-medium">All moves were in your repertoire!</p>
          )}
        </div>
      )}
    </div>
  );
}
