// Generates src/features/openings/fixtures/played-games.json from a chess.com
// account's public archives: blitz and rapid games, the first 80 plies of each.
//
// Run with: node scripts/generate-played-games-fixture.mjs [username] [until YYYY-MM-DD]
//
// The generated JSON is committed: it feeds the dev route and the tests with
// real games until the import exists.
import { Chess } from 'chess.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const USERNAME = (process.argv[2] ?? 'Piemme78').toLowerCase();
// Freezing the end date keeps the same games, so the tests' counts hold when the script is rerun.
const UNTIL = process.argv[3] ?? '9999-12-31';
const TIME_CLASSES = new Set(['blitz', 'rapid']);
// The line view reads the games past the opening, where they are decided (around move 20).
const MAX_PLIES = 80;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../src/features/openings/fixtures/played-games.json');

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

function toPlayedGame(apiGame) {
  if (apiGame.rules !== 'chess' || !TIME_CLASSES.has(apiGame.time_class) || !apiGame.pgn) return null;

  const isWhite = apiGame.white?.username?.toLowerCase() === USERNAME;
  const mine = isWhite ? apiGame.white : apiGame.black;
  const theirs = isWhite ? apiGame.black : apiGame.white;
  const score = mine?.result === 'win' ? 1 : theirs?.result === 'win' ? 0 : 0.5;

  const chess = new Chess();
  try {
    chess.loadPgn(apiGame.pgn);
  } catch {
    return null;
  }
  const moves = chess.history().slice(0, MAX_PLIES);
  if (moves.length === 0) return null;

  const playedAt = new Date(apiGame.end_time * 1000).toISOString().slice(0, 10);
  return { side: isWhite ? 'w' : 'b', moves, score, playedAt };
}

const { archives } = await getJson(`https://api.chess.com/pub/player/${USERNAME}/games/archives`);
const games = [];

for (const url of archives) {
  const { games: monthly } = await getJson(url);
  for (const apiGame of monthly ?? []) {
    const game = toPlayedGame(apiGame);
    if (game && game.playedAt <= UNTIL) games.push(game);
  }
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(games));
console.log(`${games.length} games from ${archives.length} archives → ${OUT}`);
