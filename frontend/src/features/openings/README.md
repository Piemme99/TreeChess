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
  - `repertoire.ts` — the player's repertoire, one per side: moves keyed by position.
  - `replay.ts` — the games known on a replay day, and the days to come.
  - `gameCheck.ts` — one game against the repertoire: followed, left, or not covered.
  - `addition.ts` — the moves a player played to build an addition, and the repertoire grown by them.
  - `judgement.ts` — a move graded like on Lichess (?!, ?, ??) from two evaluations.
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

1. **Repertoire from habits** — *done*: `domain/repertoire.ts`, pure, no engine; a move
   enters at a fifth of the games in the position over the 12 months before 2026-01-01
   (5 games at least); an opponent reply enters at 5 games, whatever its share (changed on
   2026-10-18: at a fifth, 426 of the 530 games of 2026 were "not covered" by move 2); moves are keyed by position, so
   transpositions share them. Computed on load (stored once decisions change it, brick 4).
   Rim on the flame graph tiles, green arrows and a "Repertoire" line on the board panel.
2. **Replay and game check, on their own page** — *done* (bricks 2 and 3 merged after PMG
   found the clock confusing on the Openings screen: daily stats mixed with global ones).
   Two pages: **Games** (`checks/`, `/dev/games`, what is to decide on top: the day's games
   that left the repertoire, then the decisions left from earlier days; the rest of the day below) lives the replay day by day — "Next day"
   jumps to the next day with games (49 in 2026), "Reset" goes back and forgets the ignored
   games — and checks each game of the day against the repertoire (`domain/gameCheck.ts`:
   followed, left the repertoire, not covered), board at the deviation (red played, green
   repertoire), "Ignore" only; the undecided games of the previous days stay below. Every
   game that left the repertoire offers "Add" and "Ignore" on its day; a first "not covered"
   left alone is not kept for the next days, only one whose opponent move comes back is
   (`asksDecision`, PMG: no game without an action). A "not covered" names only the
   opponent's move, judged by Stockfish with Lichess's thresholds (`domain/judgement.ts`:
   ?! inaccuracy, ? mistake, ?? blunder); the board shows that move alone, red when it costs. Over 2026: 226 games followed, 119 left, 185 not covered; 174
   decisions, 3 a day (median), 15 at most.
   **Openings** stays the global view, computed "as of" the replay day, no clock on it.
   The repertoire does not follow the clock: only the player's decisions will change it.
   The day and the ignored games are kept in `localStorage`.
3. *(merged into 2)*
4. **Add** — *done*: on the Games page, a game that left the repertoire offers "Add" next to
   "Ignore". The player **builds** the addition by playing on the board (`checks/BuildSession.tsx`,
   `board/PlayableBoard.tsx`: click the piece, then its square), from the position before their
   move, or after the opponent's unexpected move (which goes in with the answer). The panel
   guides without answering (`BuildPanel.tsx`): at their move, what players of their level play
   (share, score, their own games); after it, the engine's verdict (?!, ?, ??); the engine move
   only on "Hint" (orange arrow); at the opponent's move, the frequent replies to pick from.
   Back, undo, then "Add to my repertoire". PMG preferred this to a drafted tree with branches
   to cut, tried the same day: playing and searching teaches more than a ready-made answer.
   Accepted additions are a log in `localStorage` (`replay/useRepertoires.ts`,
   `domain/addition.ts`): the repertoire is the created one plus the log, on both pages, and
   "Reset" empties it. Every game is checked against the current repertoire, so an addition
   settles the game that raised it and changes the checks of the days after.
   Not done yet: "Study this line" adding to the repertoire.
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
