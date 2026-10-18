import { describe, expect, it } from 'vitest';
import { placeLine } from './pieces';

const pieceOn = (path: string[], square: string) => {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return placeLine(path).pieces.find((piece) => piece.file === file && piece.rank === rank);
};

describe('placeLine', () => {
  it('keeps the identity of a piece along the line, so the board can slide it', () => {
    expect(pieceOn(['Nf3', 'd5', 'Nc3'], 'c3')?.id).toBe(pieceOn([], 'b1')?.id);
  });

  it('moves the rook along with the king when castling', () => {
    const castled = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O'];

    expect(pieceOn(castled, 'f1')?.id).toBe(pieceOn([], 'h1')?.id);
    expect(pieceOn(castled, 'g1')?.code).toBe('wK');
  });

  it('removes the pawn taken en passant', () => {
    const line = ['e4', 'a6', 'e5', 'd5', 'exd6'];

    expect(pieceOn(line, 'd5')).toBeUndefined();
    expect(placeLine(line).lastMove).toEqual({ from: 'e5', to: 'd6' });
  });
});
