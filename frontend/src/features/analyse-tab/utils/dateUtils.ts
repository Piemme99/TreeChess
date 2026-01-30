export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatSource(source: string): string {
  switch (source) {
    case 'lichess': return 'Lichess';
    case 'chesscom': return 'Chess.com';
    case 'pgn': return 'PGN';
    default: return source;
  }
}