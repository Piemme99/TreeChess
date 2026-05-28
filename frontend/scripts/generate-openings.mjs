// Generates src/shared/data/openings.json from the lichess-org/chess-openings
// dataset (CC0). Each named opening line is replayed with chess.js to derive its
// position EPD (board + side-to-move + castling + en-passant — the first four
// FEN fields), and the EPD is mapped to its ECO code and name.
//
// Run with: node scripts/generate-openings.mjs
//
// The generated JSON is committed so the app needs no network access at runtime.
import { Chess } from 'chess.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILES = ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv'];
const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master/';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../src/shared/data/openings.json');

/** First four FEN fields identify an opening position uniquely. */
function toEpd(fen) {
  return fen.split(' ').slice(0, 4).join(' ');
}

const table = {};
let total = 0;

for (const file of FILES) {
  const res = await fetch(BASE + file);
  if (!res.ok) throw new Error(`failed to fetch ${file}: ${res.status}`);
  const text = await res.text();
  const lines = text.split('\n').slice(1); // drop header

  for (const line of lines) {
    if (!line.trim()) continue;
    const [eco, name, pgn] = line.split('\t');
    if (!eco || !name || !pgn) continue;

    const chess = new Chess();
    try {
      chess.loadPgn(pgn);
    } catch {
      continue; // skip any line chess.js can't replay
    }
    const epd = toEpd(chess.fen());
    // Longer (more specific) names win when two lines share an EPD; the
    // dataset is already roughly ordered shallow→deep, so last-write keeps
    // the more specific variation.
    table[epd] = { eco, name };
    total += 1;
  }
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(table) + '\n');
console.log(`Wrote ${Object.keys(table).length} positions (${total} lines processed) to ${OUT}`);
