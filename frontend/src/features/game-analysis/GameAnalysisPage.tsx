import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameLoader } from './hooks/useGameLoader';
import { useChessNavigation, useToggleFullGame } from './hooks/useChessNavigation';
import { useFENComputed } from './hooks/useFENComputed';
import { computeFEN, STARTING_FEN } from './utils/fenCalculator';
import { GameBoardSection } from './components/GameBoardSection';
import { GameNavigation } from './components/GameNavigation';
import { Button, Loading } from '../../shared/components/UI';
import { GameMoveList } from './components/GameMoveList';
import { toast } from '../../stores/toastStore';
import type { GameAnalysis, MoveAnalysis } from '../../types';

export function GameAnalysisPage() {
  const { gameIndex } = useParams<{ id: string; gameIndex: string }>();
  const navigate = useNavigate();

  const { analysis, loading } = useGameLoader();
  const [flipped, setFlipped] = useState(false);
  const { showFullGame, toggleFullGame } = useToggleFullGame();

  const gameIdx = parseInt(gameIndex || '0', 10);
  const game: GameAnalysis | null = useMemo(() => {
    if (!analysis || gameIdx < 0 || gameIdx >= analysis.results.length) {
      return null;
    }
    return analysis.results[gameIdx];
  }, [analysis, gameIdx]);

  useEffect(() => {
    if (game?.userColor === 'black') {
      setFlipped(true);
    }
  }, [game?.userColor]);

  const {
    currentMoveIndex,
    maxDisplayedMoveIndex,
    hasMoreMoves,
    goToMove,
    goFirst,
    goPrev,
    goNext,
    goLast
  } = useChessNavigation(game, showFullGame);

  const { currentFEN, lastMove } = useFENComputed(game, currentMoveIndex);

  const handleAddToRepertoire = useCallback((move: MoveAnalysis) => {
    if (!game || !game.userColor) return;

    // Check if a repertoire was matched
    if (!game.matchedRepertoire) {
      toast.error('No matching repertoire found for this game. Create a repertoire first.');
      return;
    }

    const moveIndex = game.moves.findIndex(m => m === move);
    if (moveIndex === -1) return;

    const parentFEN = moveIndex === 0 ? STARTING_FEN : computeFEN(game.moves, moveIndex - 1);

    const context = {
      repertoireId: game.matchedRepertoire.id,
      repertoireName: game.matchedRepertoire.name,
      parentFEN: parentFEN,
      moveSAN: move.san,
      gameInfo: `${game.headers.White || '?'} vs ${game.headers.Black || '?'}`
    };
    sessionStorage.setItem('pendingAddNode', JSON.stringify(context));

    navigate(`/repertoire/${game.matchedRepertoire.id}/edit`);
  }, [game, navigate]);

  if (loading) {
    return (
      <div className="game-analysis">
        <Loading size="lg" text="Loading game..." />
      </div>
    );
  }

  if (!analysis || !game) {
    return (
      <div className="game-analysis">
        <div className="game-analysis-error">
          <p>Game not found</p>
          <Button variant="primary" onClick={() => navigate('/')}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  const opponent = game.headers.White && game.headers.Black
    ? `${game.headers.White} vs ${game.headers.Black}`
    : 'Unknown players';
  const result = game.headers.Result || '*';

  return (
    <div className="game-analysis">
      <header className="game-analysis-header">
        <Button variant="ghost" onClick={() => navigate('/')}>
          &larr; Back
        </Button>
        <div className="game-analysis-title">
          <span className="game-title-main">Game {gameIdx + 1}: {opponent}</span>
          <span className="game-title-result">{result}</span>
        </div>
        <div className="header-spacer" />
      </header>

      {/* Show matched repertoire info */}
      {game.matchedRepertoire ? (
        <div className="game-analysis-repertoire-info">
          Analyzed against: <strong>{game.matchedRepertoire.name}</strong>
          {game.matchScore !== undefined && game.matchScore > 0 && (
            <span className="match-score"> ({game.matchScore} moves matched)</span>
          )}
        </div>
      ) : (
        <div className="game-analysis-repertoire-info game-analysis-no-repertoire">
          No matching repertoire found for this game
        </div>
      )}

      <div className="game-analysis-content">
        <GameBoardSection
          fen={currentFEN}
          orientation={flipped ? 'black' : 'white'}
          lastMove={lastMove}
          flipped={flipped}
          onFlip={() => setFlipped(!flipped)}
        />

        <div className="game-analysis-moves-section">
          <h3>Opening</h3>
          <GameMoveList
            moves={game.moves}
            currentMoveIndex={currentMoveIndex}
            maxDisplayedIndex={maxDisplayedMoveIndex}
            onMoveClick={goToMove}
            onAddToRepertoire={game.matchedRepertoire ? handleAddToRepertoire : undefined}
            showFullGame={showFullGame}
            hasMoreMoves={hasMoreMoves}
            onToggleFullGame={toggleFullGame}
          />
        </div>
      </div>

      <GameNavigation
        currentMoveIndex={currentMoveIndex}
        maxDisplayedMoveIndex={maxDisplayedMoveIndex}
        goFirst={goFirst}
        goPrev={goPrev}
        goNext={goNext}
        goLast={goLast}
      />
    </div>
  );
}
