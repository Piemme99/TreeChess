import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { importApi } from '../../services/api';
import { toast } from '../../stores/toastStore';
import { Button, Loading } from '../UI';
import { ChessBoard } from '../Board/ChessBoard';
import { GameMoveList } from './GameMoveList';
import type { AnalysisDetail, MoveAnalysis, GameAnalysis } from '../../types';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Default number of plies to show (opening phase)
// 20 plies = 10 moves per side
const DEFAULT_OPENING_PLIES = 20;

function computeFEN(moves: MoveAnalysis[], upToIndex: number): string {
  if (upToIndex < 0) return STARTING_FEN;

  const chess = new Chess();
  for (let i = 0; i <= upToIndex && i < moves.length; i++) {
    try {
      chess.move(moves[i].san);
    } catch {
      console.error('Invalid move:', moves[i].san);
      break;
    }
  }
  return chess.fen();
}

function getLastMove(moves: MoveAnalysis[], currentIndex: number): { from: string; to: string } | null {
  if (currentIndex < 0 || currentIndex >= moves.length) return null;

  const chess = new Chess();
  for (let i = 0; i <= currentIndex && i < moves.length; i++) {
    try {
      const move = chess.move(moves[i].san);
      if (i === currentIndex && move) {
        return { from: move.from, to: move.to };
      }
    } catch {
      break;
    }
  }
  return null;
}

export function GameAnalysisPage() {
  const { id, gameIndex } = useParams<{ id: string; gameIndex: string }>();
  const navigate = useNavigate();

  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1); // -1 = starting position
  const [flipped, setFlipped] = useState(false);
  const [showFullGame, setShowFullGame] = useState(false);

  const gameIdx = parseInt(gameIndex || '0', 10);

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

  const game: GameAnalysis | null = useMemo(() => {
    if (!analysis || gameIdx < 0 || gameIdx >= analysis.results.length) {
      return null;
    }
    return analysis.results[gameIdx];
  }, [analysis, gameIdx]);

  // Auto-flip board based on user's color in this game
  useEffect(() => {
    if (game?.userColor === 'black') {
      setFlipped(true);
    }
  }, [game?.userColor]);

  // Calculate the max move index to display
  const maxDisplayedMoveIndex = useMemo(() => {
    if (!game) return -1;
    if (showFullGame) return game.moves.length - 1;
    return Math.min(DEFAULT_OPENING_PLIES - 1, game.moves.length - 1);
  }, [game, showFullGame]);

  const hasMoreMoves = useMemo(() => {
    if (!game) return false;
    return game.moves.length > DEFAULT_OPENING_PLIES;
  }, [game]);

  const currentFEN = useMemo(() => {
    if (!game) return STARTING_FEN;
    return computeFEN(game.moves, currentMoveIndex);
  }, [game, currentMoveIndex]);

  const lastMove = useMemo(() => {
    if (!game) return null;
    return getLastMove(game.moves, currentMoveIndex);
  }, [game, currentMoveIndex]);

  const goToMove = useCallback((index: number) => {
    if (!game) return;
    setCurrentMoveIndex(Math.max(-1, Math.min(index, maxDisplayedMoveIndex)));
  }, [game, maxDisplayedMoveIndex]);

  const goFirst = useCallback(() => goToMove(-1), [goToMove]);
  const goPrev = useCallback(() => goToMove(currentMoveIndex - 1), [goToMove, currentMoveIndex]);
  const goNext = useCallback(() => goToMove(currentMoveIndex + 1), [goToMove, currentMoveIndex]);
  const goLast = useCallback(() => goToMove(maxDisplayedMoveIndex), [goToMove, maxDisplayedMoveIndex]);

  const handleToggleFullGame = useCallback(() => {
    setShowFullGame((prev) => !prev);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goNext();
          break;
        case 'Home':
          e.preventDefault();
          goFirst();
          break;
        case 'End':
          e.preventDefault();
          goLast();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goFirst, goPrev, goNext, goLast]);

  const handleAddToRepertoire = useCallback((move: MoveAnalysis) => {
    if (!game || !game.userColor) return;

    // Find the index of this move
    const moveIndex = game.moves.findIndex(m => m === move);
    if (moveIndex === -1) return;

    // Compute the FEN BEFORE this move (parent position)
    const parentFEN = moveIndex === 0 ? STARTING_FEN : computeFEN(game.moves, moveIndex - 1);

    const context = {
      color: game.userColor,
      parentFEN: parentFEN,
      moveSAN: move.san,
      gameInfo: `${game.headers.White || '?'} vs ${game.headers.Black || '?'}`
    };
    sessionStorage.setItem('pendingAddNode', JSON.stringify(context));

    navigate(`/repertoire/${game.userColor}/edit`);
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
          <Button variant="primary" onClick={() => navigate(`/analyse/${id}`)}>
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
        <Button variant="ghost" onClick={() => navigate(`/analyse/${id}`)}>
          &larr; Back
        </Button>
        <div className="game-analysis-title">
          <span className="game-title-main">Game {gameIdx + 1}: {opponent}</span>
          <span className="game-title-result">{result}</span>
        </div>
        <div className="header-spacer" />
      </header>

      <div className="game-analysis-content">
        <div className="game-analysis-board-section">
          <ChessBoard
            fen={currentFEN}
            orientation={flipped ? 'black' : 'white'}
            interactive={false}
            lastMove={lastMove}
            width={350}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setFlipped(!flipped)}
            className="flip-board-btn"
          >
            Flip Board
          </Button>
        </div>

        <div className="game-analysis-moves-section">
          <h3>Opening</h3>
          <GameMoveList
            moves={game.moves}
            currentMoveIndex={currentMoveIndex}
            maxDisplayedIndex={maxDisplayedMoveIndex}
            onMoveClick={goToMove}
            onAddToRepertoire={handleAddToRepertoire}
            showFullGame={showFullGame}
            hasMoreMoves={hasMoreMoves}
            onToggleFullGame={handleToggleFullGame}
          />
        </div>
      </div>

      <div className="game-analysis-nav">
        <Button variant="secondary" size="sm" onClick={goFirst} disabled={currentMoveIndex === -1}>
          ⟪
        </Button>
        <Button variant="secondary" size="sm" onClick={goPrev} disabled={currentMoveIndex === -1}>
          ⟨
        </Button>
        <span className="nav-info">
          Move {currentMoveIndex + 1} / {maxDisplayedMoveIndex + 1}
        </span>
        <Button variant="secondary" size="sm" onClick={goNext} disabled={currentMoveIndex >= maxDisplayedMoveIndex}>
          ⟩
        </Button>
        <Button variant="secondary" size="sm" onClick={goLast} disabled={currentMoveIndex >= maxDisplayedMoveIndex}>
          ⟫
        </Button>
      </div>
    </div>
  );
}
