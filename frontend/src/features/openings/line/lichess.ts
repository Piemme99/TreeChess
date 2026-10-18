// Lichess plutôt que chess.com : gratuit, libre, et l'analyse y marche sans compte.
export function lichessPosition(fen: string, black: boolean) {
  return `https://lichess.org/analysis/standard/${fen.replaceAll(' ', '_')}${black ? '?color=black' : ''}`;
}

/** La partie entière dans l'analyse Lichess, ouverte au demi-coup donné. */
export function lichessGame(moves: readonly string[], ply: number, black: boolean) {
  return `https://lichess.org/analysis/pgn/${moves.map(encodeURIComponent).join('_')}${black ? '?color=black' : ''}#${ply}`;
}

/** Une partie contre Stockfish sur Lichess, qui démarre de la position donnée. */
export function lichessVsComputer(fen: string) {
  return `https://lichess.org/?fen=${encodeURIComponent(fen)}#ai`;
}

// Lichess classe ses puzzles par famille d'ouverture (« Philidor_Defense ») ; une clé inconnue renvoie à l'accueil des puzzles.
export function lichessPuzzles(openingName: string) {
  const family = openingName.split(':')[0].replaceAll("'", '').trim().replaceAll(' ', '_');
  return `https://lichess.org/training/${family}`;
}
