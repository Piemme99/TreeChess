# Openings — the v2 macro screen

"Where do my points go, and what do I work on first?" Built brick by brick from
the v2 POC (`poc/v2-macro-loop`), each brick validated before the next. The POC
is a source of ideas and validated formulas, never of code.

Dev-only route: `/dev/flame-graph` (not built in production, see `App.tsx`).
Vocabulary (opening tree, deficit, priority, points to gain): `CONTEXT.md`.

## Layout

- `domain/` — pure, tested, no React.
  - `playedGame.ts` — the input contract. Moves are **canonical SAN already
    validated by chess.js**: the tree never replays them (chess.js costs ~0.1 ms
    per move, i.e. seconds over a history). `playedAt` is an ISO date.
  - `openingTree.ts` — games merged move by move, per side. No FEN stored.
  - `performance.ts` — player average, smoothed deficit.
  - `priorities.ts` — weak lines, proven on two time scales, weighed on the last 12 months.
  - `line.ts` — a line studied on its own: score move after move, extended by its
    most played continuation, and the moves played at each of its positions.
  - `diagnosis.ts` — engine against results on a line: what the opening moves cost,
    what is lost after, the key position, and the decisive mistake of each game.
  - `preparation.ts` — the proposed preparation from the key position (habits the
    engine accepts, else the move most played at the player's level that it accepts).
  - `period.ts`, `notation.ts`.
- `OpeningsPage.tsx` — the screen: priority tickets, flame graph as tiles, board panel.
- `flame/` — layout (pure), camera (`useFlameCamera`: zooming moves a window over fixed
  coordinates, so tiles slide out of frame instead of vanishing) and the tiles.
- `priorities/` — the priority tickets.
- `line/` — the line view ("Study this line"), opened from the board panel: verdict,
  a two-step plan, the whole line folded below. `engine.ts` queues Stockfish
  evaluations on a dedicated worker; `explorer.ts` queries the Lichess explorer with a
  personal token in `VITE_LICHESS_TOKEN` (`frontend/.env.local`) until it goes through the
  backend's Lichess OAuth and explorer proxy (`GET /api/training/opening`).
- `position/` — the board panel; positions are replayed on demand (`replay.ts`).
- `board/` — the board whose pieces slide from one position to the next (`pieces.ts`
  gives each piece a stable identity along a line).
- `workshop/` — the Workshop art direction: colours, tones, springs, small shared objects.
- `fixtures/` — Piemme78's real games (chess.com, blitz + rapid, first 80 plies), regenerated
  by `node scripts/generate-played-games-fixture.mjs Piemme78 2026-08-09` (the end date keeps
  the tests' counts). Stand-in until the import exists.

## Decisions, and what was rejected

- **Colour = deficit vs the player's own average**, not engine eval. Grey below 20
  games; lines under 10 games are not drawn.
- **Only the player's moves are coloured.** Opponent moves are thin grey rows: the
  player does not choose them, and the deficit already shows on their reply.
- **No sentences in graphs, English UI**: short labels and numbers.
- **A priority always ends on one of the player's moves** and says they play the
  line badly. Suggesting another opening ("better reply") was tried and removed:
  on real games it only ever proposed changing openings, which is the player's choice.
- **Two time scales.** Proving on the last year alone loses old problems still
  played rarely; proving on the whole history alone drowns recent ones. A line is a
  priority if proven on the whole history *and still current* (played, not back at
  average over 12 months), or proven on the last 12 months. All are weighed on the
  points lost over the last 12 months. A period selector was tried and removed.
- **Impact bar, not a number**: "points to gain" only serves ranking.
- **The flame graph is pruned** (prototype of 2026-10-18, "Pruned" chosen over "player rows
  only" and "heat map"): lines too thin to read at the current zoom fold into one hatched
  "…" tile per parent, rows are not drawn once they cover less than 40% of the width, and
  what is folded at the root unfolds on zoom (the tree goes 24 plies deep for that). Par and
  solid recede towards the paper, priorities are pinned on their tile (a dot when folded
  below), opponent rows are thin, labels use figurines and add games and score when they fit,
  and a card follows the pointer. Measured at the root on real games: 342 tiles became 45.
- **Art direction: Workshop** (warm cream, kumquat, Bricolage Grotesque, tactile tiles,
  springs), chosen over six other directions; verdict in `design-prototype/NOTES.md`.
  Everything on the screen, line view included, uses `workshop/theme.ts`.
- **Clicking a priority previews it** (side, zoom, board) and stays on the page; studying
  the line is an explicit "Study this line" from the board panel. Opening the line view
  straight from the click was tried and rejected: a click must give a preview first.
- **The board panel shows both periods** (all time, last 12 months): the tickets rank on
  the last 12 months, a single all-time score next to them reads as a contradiction.
- **The line view reads the last 12 months**, like the priority that opened it, so
  the games counted match. Its line goes on past the entry point along the most played
  continuation (≥ 5 games and ≥ 10% of the line): the entry identifies the problem, it
  does not bound the work. Moves seen fewer than 3 times are hidden, except the line's.
  A move off the line opens that line in turn.
- **The line view tells a bad move from a position played badly** (prototype of
  2026-10-18, four layouts then "engine vs you"). Results alone pointed at theory moves
  (Philidor: "−29 pts" on 4…♘f6, the main line); the engine shows that on the five real
  priorities no move of the player costs more than ~3 pts, the points go after the opening.
  So: **verdict first** (what the opening moves cost vs what is lost after, a position
  being worth the engine's winning chances — Lichess formula — shifted to the player's
  average), then **a plan, not a list of blunders**: 1. extend the preparation from the key
  position, past the player's games, with what players of their level play (ADR 0002 amended);
  2. practise the position (Stockfish and puzzles on Lichess, masters' moves and games, the
  decisive mistakes of the player's games, each opening on Lichess at that move). Rejected:
  a score curve along the line, "engine vs you" move by move, and a monthly score chart
  (they said nothing to act on); a games-only preparation (the games scatter one to three
  moves after the key position); chess.com links (its analysis is paid — **free, open
  source tools only**, Lichess). The decisive mistake is the biggest drop, not the first
  slip, measured from the lower of the two previous positions so a recapture is not blamed.
- **The whole line** (the "fork map", liked but intimidating for a newcomer) is folded
  below, opponent rows reduced to the line's move until asked. Arrows on boards: three at
  most, with a cream halo to stand out on the green squares.

## Next: the repertoire loop

Designed on 2026-10-18 (vocabulary in `CONTEXT.md`: repertoire, game check, proposed
addition, pending decision, worked line, adherence; ADR 0002 amended). One
**repertoire** per side, created from the player's habits, strengthened on priorities,
enriched after each game. Shown on a **replay** of the history: the repertoire is
created from the games before 2026-01-01, then the 2026 games come in day by day.
Built one brick at a time, each visible on its own:

1. **Repertoire from habits**: pure domain, no engine; a move of the player enters at
   a fifth of their games in the position over the last 12 months (5 games at least),
   opponent replies likewise. Stored in the browser. Rim on the flame graph tiles,
   green arrows on the board.
2. **Replay**: a "today" date, "Next day", reset; the whole screen computed at that date.
3. **Game check and "To decide"** list, with "Ignore" only.
4. **Add**: a proposed addition accepted after cutting branches; several player moves
   per position; also used by "Study this line".
5. **Review**: minimal debrief (red arrow played, green arrows repertoire, replay it).
6. **Worked lines**: adherence, then score against before, on the priority tickets.
7. **Engine correction at creation, and removals** (six months without the move).

## Later

- **Line view, next steps**: plug the explorer into the backend OAuth with the import;
  glossary entries for key position and decisive mistake.
- **Import** producing `PlayedGame` (Lichess OAuth is the decided auth; validate SAN
  there), then persistence.
- **Engine signal on the whole tree** (priorities sorted into "a move to change" and
  "a position to work on" from the Openings screen): the line view does it per line only.
- **Design prototype** (`design-prototype/`, `/dev/flame-graph?variant=F…J`): the
  directions not chosen, kept for reference. They share the domain and `board/`, `flame/`,
  `workshop/` with the page; keep them compiling.
