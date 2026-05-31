import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvalBar } from './EvalBar';

const WHITE_TO_MOVE = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const BLACK_TO_MOVE = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1';

describe('EvalBar accessibility', () => {
  it('exposes a signed text alternative favouring white', () => {
    render(<EvalBar score={120} mate={undefined} fen={WHITE_TO_MOVE} />);
    expect(screen.getByRole('img', { name: 'White +1.2' })).toBeInTheDocument();
  });

  it('normalizes the score to white perspective when black is to move', () => {
    // Stockfish reports +1.2 for the side to move (black) => white is losing.
    render(<EvalBar score={120} mate={undefined} fen={BLACK_TO_MOVE} />);
    expect(screen.getByRole('img', { name: 'Black +1.2' })).toBeInTheDocument();
  });

  it('describes a forced mate', () => {
    render(<EvalBar score={undefined} mate={3} fen={WHITE_TO_MOVE} />);
    expect(screen.getByRole('img', { name: 'White M3' })).toBeInTheDocument();
  });

  it('reports an even position', () => {
    render(<EvalBar score={0} mate={undefined} fen={WHITE_TO_MOVE} />);
    expect(screen.getByRole('img', { name: 'Even' })).toBeInTheDocument();
  });

  it('reports when no evaluation is available', () => {
    render(<EvalBar score={undefined} mate={undefined} fen={WHITE_TO_MOVE} />);
    expect(screen.getByRole('img', { name: 'Evaluation unavailable' })).toBeInTheDocument();
  });
});
