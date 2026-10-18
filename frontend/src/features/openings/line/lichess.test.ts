import { describe, expect, it } from 'vitest';
import { lichessGame, lichessPosition, lichessPuzzles, lichessVsComputer } from './lichess';

const FEN = 'rnbqkb1r/ppp2ppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5';

describe('Lichess links', () => {
  it('opens a position in the analysis board, from the player side', () => {
    expect(lichessPosition(FEN, true)).toBe('https://lichess.org/analysis/standard/rnbqkb1r/ppp2ppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R_w_KQkq_-_1_5?color=black');
  });

  it('opens a whole game at a given ply, escaping what a URL would cut', () => {
    expect(lichessGame(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'], 4, false)).toBe(
      'https://lichess.org/analysis/pgn/e4_e5_Qh5_Nc6_Bc4_Nf6_Qxf7%23#4',
    );
  });

  it('starts a game against the computer from a position', () => {
    expect(lichessVsComputer(FEN)).toBe(`https://lichess.org/?fen=${encodeURIComponent(FEN)}#ai`);
  });

  it('points to the puzzles of the opening family', () => {
    expect(lichessPuzzles("Queen's Pawn Game: Chigorin Variation")).toBe('https://lichess.org/training/Queens_Pawn_Game');
  });
});
