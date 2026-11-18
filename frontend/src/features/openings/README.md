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
  - `diagnosis.ts` — an engine evaluation, its winning chances (Lichess formula), UCI to SAN.
  - `preparation.ts` — the Lichess explorer stats and the source of a repertoire move.
  - `period.ts`, `notation.ts`.
- `OpeningsPage.tsx` — the screen: priority tickets, flame graph as tiles, board panel.
- `flame/` — layout (pure), camera (`useFlameCamera`: zooming moves a window over fixed
  coordinates, so tiles slide out of frame instead of vanishing) and the tiles.
- `priorities/` — the priority tickets.
- `line/` — what the line view (deleted 2026-11-17, replaced by the Weak opening task) left in use:
  `ArrowBoard.tsx`, arrow colours in `tone.ts`. `engine.ts` queues Stockfish
  evaluations on a dedicated worker; `explorer.ts` queries the Lichess explorer through the
  backend relay `GET /api/explorer/{lichess,masters}`, which uses the signed-in user's Lichess
  token ("Sign in with Lichess" in the header) and serves cached positions to everyone. In dev
  without a backend, a personal token in `VITE_LICHESS_TOKEN` (`frontend/.env.local`) queries
  Lichess directly.
- `session/` — the positions the games left, grouped by position and move (`steps.ts`), judged by the engine
  (`verdict.ts`); `useReplayedSession` feeds Home and the tree.
- `home/` — Home (`/dev/home`, "Path by use"): the simulated import on the first visit, then one hero card and
  one-line rows.
- `review/` — the review drill (`/dev/review`): `domain/review.ts` (Leitner boxes seeded from habits, the line to
  play, the opponent's reply), `useReview.ts` (stored state, lapses from game checks, weights).
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
- **Impact bar, not a number**: "points to gain" only serves ranking. The figure shown is the
  score on the line against the player's average ("43% · avg 53%"): "−4 pts" read as nothing,
  and it is shrunk on small samples so it is not the points actually lost.
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
- **One colour per meaning on every board** (`ARROW` in `workshop/theme.ts`): repertoire green,
  engine orange, a move that costs points red, other played moves grey. Screens ask for a
  meaning, never a colour (PMG, 2026-10-18: the engine was green on Openings, orange on Games).
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
  position, past the player's games, with what players of their level play;
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
addition, pending decision, worked line, adherence). One
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
   `board/PlayableBoard.tsx`, on react-chessboard like the v1: drag the piece, or click it then its square), from the position before their
   move, or after the opponent's unexpected move (which goes in with the answer). The panel
   guides without answering (`BuildPanel.tsx`, `useCandidates.ts`): a table, one row per
   candidate move (three from the explorer, the engine's move, the player's own: PMG wanted
   few), with the share and the side's score at the named level (1400–1800 blitz & rapid), the
   engine's evaluation after the move, their own games; a move the engine marks (?!, ?, ??)
   drops to the bottom of the table, faded, with no arrow on the board: not suggested, still
   one click away if the player wants it (PMG: never recommend a middling move); the engine's
   move is tagged and drawn in orange at once. PMG asked for visuals over sentences: an eval
   bar for the position, chips for the moves played so far (the last marked by the engine),
   a dot on each arrow's landing square, swatches under the board, no legend prose (a "Hint" button was tried and dropped the same
   day: every tool that helps the choice is on the table from the start). Every row is an arrow
   on the board, thicker when played more: clicking where it lands plays it, so does its row;
   any other move is played piece then square, and judged once played. At the opponent's move,
   the same table over the frequent replies (≥ 5%, four at most). Each move of "To add" is clickable to return there and open a branch, the arrow keys
   move like on Lichess (← → one move, ↑ start, ↓ end of the last branch); "Back" was
   dropped (it differed from undo only in keeping the move, invisibly). Undo, then
   "Add to my repertoire", only once a move of the player's is in. PMG preferred building to a
   drafted tree with branches to cut, tried the same day: playing and searching teaches more
   than a ready-made answer.
   Accepted additions are a log in `localStorage` (`replay/useRepertoires.ts`,
   `domain/addition.ts`): the repertoire is the created one plus the log, on both pages, and
   "Reset" empties it. Every game is checked against the current repertoire, so an addition
   settles the game that raised it and changes the checks of the days after.
   Not done yet: "Study this line" adding to the repertoire.
**Since 2026-10-18 ("User path"): a router with two doors ("I just played",
"I want to work") leading to one position screen, phone first, browsable like an explorer.**
Pending decisions are grouped by position (2026: 174 decisions, 58 positions). Openings,
Games and the line view leave the path; bricks 5–7 wait for the position screen.

5. **Review**: minimal debrief (red arrow played, green arrows repertoire, replay it).
6. **Worked lines**: adherence, then score against before, on the priority tickets.
7. **Engine correction at creation, and removals** (six months without the move).

## POC: the tree as the landing screen (grilled with PMG, 2026-10-19)

Tries the v1 repertoire tree (`features/repertoire/shared/components/RepertoireTree/`, node-link,
tidy layout, pan/zoom) as the landing screen, next to the router (`/dev/home`) so the two can be
compared.

1. **One screen, two panes, computer first.** The tree on the left, the position pane on the
   right. Below ~700 px the panes stack, unpolished: on the phone the path stays the notification
   and `/dev/session`. One tree per side, side switch in the header.
2. **The tree draws the v2 repertoire** (`domain/repertoire.ts` plus the additions log), left to
   right, one ply per column, Workshop art direction. A position reached by two move orders is drawn
   once; the other arrival is a stub "= …" that is not unfolded. Measured on Piemme78 (created on
   2026-01-01): 194 positions as White, 166 as Black, 15 plies deep, up to 10 replies at a position.
3. **Three encodings, nothing else**: edge thickness = games through it over the last 12 months;
   a badge on a node = pending decisions there, showing the games that raised them ("37"); a pin on
   a node = priority, with its rank. No deficit colour, no score: that is the flame graph, which
   says what the player does. Scores live in the pane. A board on hover, like the v1.
4. **Folded beyond the 6th ply, and below 2 % of the side's games** ("+N" tab on the last visible
   node, click unfolds, double click folds), except the paths to a badge or a pin, always open: the
   landing must say where to act without zooming. The share rule was added while building brick 1:
   by depth alone the six first plies still made 135 nodes and 56 leaves as White, fitted at 23 %
   and unreadable; with it, 49 nodes and 15 leaves, fitted at 71 %.
5. **The header holds the two doors as figures**: "20 to settle" starts the session on the first
   badge, "Priority 1" focuses the first pin. Clicking any node fills the pane.
6. **One pane, blocks by what the position carries**: board (repertoire green, played grey), the
   repertoire's moves, then only the blocks present: "To settle" (deviation facts, Keep / Stay on /
   Prepare an answer / Skip) and "Priority n" (verdict, "Prepare what follows", Lichess link). The
   door only picks the starting node and what "Next" steps through; after the last badge, "Done for
   today" and back to the root. 1.d4 d5 as Black is both a priority and 25 checks: it shows both.
7. **"Extend from here" on every position**, opening `BuildSession` from it (same board, same
   candidate table as Keep and Prepare). No deletion: removal stays a proposed decision (brick 7).

Bricks: (1) the tree alone on `/dev/tree` — *done* (`tree/`: `repertoireMap.ts` builds the map
from the repertoire, the recent opening tree and the marks; `fold.ts` what is visible; `mapLayout.ts`
on d3-hierarchy; `RepertoireMap.tsx` the SVG with pan, zoom, hover board; `PositionPane.tsx` a playable board
(PMG, 2026-10-19: one plays on it like on the Lichess explorer — a move walks the tree, a move off the
repertoire is said so, ← → ↑ as in "Add"); `position/arrows.ts` three arrows at most, the most
frequent deviation first then the repertoire moves most played over 12 months, thick by share, a
landing dot only on those (PMG: fewer arrows, the relevant ones; the same rule now drives the
Openings board panel); `TreePage.tsx` the two panes and the two doors
as figures); (2) the pane's blocks and "Next" — *done*: "To settle" with the facts and Keep / Stay on /
Prepare an answer (Keep and Prepare open `checks/BuildSession` in place of the two panes, back on
accept or cancel), "Priority n" with "Next priority"; the "to settle" door starts the session, which
steps through the positions (counter, "Skip for now" postpones, "Done for today" at the end), the
same blocks settle a position outside the session too. (3) "Extend from here" — *done*: `useBuilder`
now starts from a `BuildOrigin` (side, start position, moves already given, the move judged, keep)
instead of a game check; `originOf` builds it from a check, `originAt` from any position of the
tree, the board's line included when it already left the repertoire (those moves are given, and a
player's move among them completes the addition on its own). "Extend from here" is on every
position; "Prepare what follows" on a priority builds from its end. The accepted line is revealed
and selected on return. Left: the priority verdict (engine) on the pane.

## Path by use (PMG, 2026-11-16)

Why: on the phone Tree, Openings and Games looked alike (same board on top, same header, same "Next day";
Openings' top half repeats Tree and its Priorities button). The tabs split the app by data (positions,
statistics, games), not by what the player comes to do. The app is now organised around the player's uses;
the repertoire (the tree) is the object every use opens at one of its positions, not a use of its own.

1. **Import** my games and get my repertoire, **and see my weak openings** to work on.
2. **After a game**: check I followed my preparation; on a new line, analyse it and decide whether to add it.
3. **Review** my repertoire.
4. *Later*: **practise** — play openings in a loop against Lichess's most played moves, and feed the
   repertoire with what I play (the v1 "explorer training", `features/training/`, is a base). A practice
   game that leaves the repertoire is checked like a real one (use 2).

Closing use 1: **does the work pay** on a line I worked on — said where it means something, on a new game
through that line.

Challenged once by a fresh reviewer before the POC: Today was four doors (the router again), the report
competed with Today on the first day, the review quizzed moves played 2 000 times, the games card counted
games while the session counts positions. Fixed below.

**Navigation: two places, three tasks** (target path, `docs/flow/target.html`, PMG 2026-11-17). Two tabs on
every screen: **Home** says what waits, **Repertoire** is the tree, to browse and extend. Three tasks start from
Home and take the whole screen: **Check**, **Weak opening**, **Review**. A task shows a dark bar (✕ back to Home,
its name, "2 of 5") and always ends on a summary with "Back to Home". Repertoire starts no task: a position with
something to settle shows its card in place. The demo replay lives in the header's ⋯ menu. Games is dev-only;
Openings stays the computer view of the results, from ⋯. One figure, "to settle", counts decisions (a move to settle, one per screen in Check) after the
engine's verdict, the same on Home, in Check and on the tree; one name, "Weak openings", for priorities.

Home was called Today until 2026-11-17: on the first day it shows a report of the whole history, and after
days away a week of games, so "Today" misled.

### Screen 1 — Import (first visit only)

"Build your repertoire from your games", a Lichess username (the signed-in account by default), "Import",
a progress line. Leads to Home in its first-day state. The real import is the "Import" brick of "Later";
the POC replays PMG's fixture as if it came in.

### Screen 2 — Home

**One hero card, the most urgent non-empty one, its button on top; every other task is a one-line row.**

- **First day** (just imported, no game since): hero = **"Weak openings"**, one line of facts ("2 557 games ·
  repertoire: 194 positions as White, 166 as Black"), the three heaviest, each with **"Work on it"**.
- **New games**: hero = "11 new games", "6 to settle", **"Check them"**, then one line per game: ! a mistake to
  settle (the engine finds the move worse), ? an opponent move with no answer yet, · a move off the repertoire
  that waits for nothing, ✓ prep followed. A game through a worked line says it.
- **Review due**: hero = "Review", "5 lines" → **"Start"**.
- **Else**: hero = weak opening 1 → "Work on it".
- **Nothing left**: hero = "Nothing to do now" → "Browse your repertoire".

A weak opening already **worked** is not something to do (`splitWorked`): the 12-month score would take months to
show the work, so it never takes the hero card, not even on the first day. It sits in its own row, "Worked openings"
(adherence, "Open"), and comes back to do only once the games played since the work prove it weak again (same bar
as a priority: 20 games, below average beyond noise).

Rows under the hero: "To settle · 6", "Review · 5 lines", "Weak openings · Queen's Pawn Game 41%" (expands),
"Worked openings · Caro-Kann Defense" (expands).

### Screen 3 — Check (use 2)

The tree with `?task=check`: the positions to settle one at a time (Add · Keep · Prepare a reply · Not worth
it, Skip for now, Undo), then "3 settled · 2 skipped for later". Games that followed the preparation make no step.

### Screen 4 — Weak opening (use 1)

The tree with `?task=weak&side=…&line=…`: the card (verdict, "Prepare my moves after…", "Next weak opening").
Accepting the preparation ends on "2 moves added · Next weak opening / Back to Home" and marks the line
**worked** from that day: new games through it report adherence (prep followed N of M).

### Screen 5 — Review (use 3)

- **What is due.** Spaced repetition by position where the player is to move, three boxes (1, 7, 30 days),
  a miss sends back to 1. At the import, a position the player answers with the repertoire move in ≥ 90 %
  of ≥ 10 games starts in the 30-day box (spread over the month): no quiz on 1.e4. Due from the start: the
  positions where the player varies, too few games, the additions. A position missed in a game check after
  its last review is due again, and weighs more.
- **A line.** The app picks the due position that weighs most (missed in a game, then a recent addition, then
  the rest; within each, the one met in the most games over 12 months), plays the line to it by itself up to the
  player's two moves before it (further when the line begins like one already played in the session: up to
  where it leaves it, or to the first due position on the way, so the player replays no move of the session
  and skips nothing due; also past a position where the repertoire has several moves and that is not due, the
  app playing the one that leads to the target, which the player could not guess), then the player plays; opponent moves are played by the app, choosing the
  reply that leads to the most due positions; the line goes on while something is due ahead. Any of
  several repertoire moves is right.
- **Wrong** → the repertoire move(s) in green on the board, the player plays it to go on, the position goes
  back to box 1. A position passed on the way that was not due is not rescheduled unless missed.
- **5 lines a session**, started at once from Home, then "4 of 5 lines clean · 2 positions to see again tomorrow".
- **Repertoire known** (PMG, 2026-11-18): each position counts its box out of three (box 1 a third, box 3 all of
  it), one box less while its review is overdue; never reviewed or last missed (in review or in a game) counts 0,
  so missing a new position never raises the figure; every position weighs the same, so a rare sideline moves the
  figure as much as 1.e4. The positions seeded in the 30-day box count as known: the games prove them. Shown on
  Home's Review hero and row, and at the end of a session to one decimal ("47.6% → 48.1%": a session moves a few
  positions out of hundreds). On PMG's games at the import: 46% as White, 52% as Black (weighted by games it would
  read 84% and 83%, which hides the sidelines).

### Not in the POC

The real import, practice, the score comparison of worked lines.

### POC (`home/`, `review/`, `tree/`)

Dev routes, PMG's fixture as the imported history, the replay clock as time: `/dev/home` (import on the first
visit, then Home), `/dev/review`, `/dev/tree` (Repertoire, or a task with `?task=`). Published under `/v2/`.

## Import (PMG, 2026-11-17: Lichess only for now)

Why: every visitor sees PMG's games, replayed day by day. The import replaces them with the player's own
games, stored on the server; with the decisions stored there too (brick 3), v1 can be deleted.

Facts: the fixture is PMG's **chess.com** history (blitz and rapid, 5 654 games, May 2023 to Aug 2026, first 80
plies). On Lichess PMG has 855 games (287 bullet, 375 blitz, 183 rapid). The account is Lichess (OAuth, needed by
the explorer relay). PMG chose Lichess only for now; chess.com (where his history is) can come later as a second
source of the same table.

### Screen 1 — Sign in (signed-out visitor)

"Build your repertoire from your games", **"Sign in with Lichess"** (the games and the decisions are kept on
your account). Below: "Try it on a sample player" opens today's demo (PMG's games, the replay in ⋯, everything in
the browser), unchanged.

### Screen 2 — Your games (first visit after sign-in)

The Lichess account is filled in ("Lichess · Piemme78"). One button, **"Import"**. Kept: standard chess, blitz, rapid and classical (bullet left out, as
in the fixture: too fast to follow a preparation), the first 80 plies.

### Screen 3 — Import running

"Importing your games… 1 240", the count growing. The server does the work: leaving the page does not stop it,
coming back shows where it is. PMG's 558 Lichess games took 28 s (`GET /api/games/user`, NDJSON, with the
account's token). At the end, Home in its first-day state
("Weak openings"), built from the games of the last 12 months as today.

### Later visits

Opening Home fetches the games played since the last import (a few seconds); they are the "new games" of the
hero card. No replay for a signed-in player: "Next day" and "Reset" stay in the demo only.

### Bricks

1. **Import and store** (done): `played_games` and `played_game_imports` tables, `POST|GET /api/v2/games/import`,
   `GET /api/v2/games` (`backend/internal/services/played_game_import.go`); screens 1–3; pages read their games
   through `source/` (imported games, or the demo fixture with its replay). The repertoire is born the day of the
   import from every game up to it. Decisions, additions, review and worked lines stay in the browser, one set per
   source (`workshop/storage.ts`).
2. **New games at each visit** (done): once per load of the app, the server reads Lichess from the day before
   the last known game (`since`), duplicates dropped; Home says "Looking for new games on Lichess…". The new games
   are those of the last day played since the import (`lastDayPlayed`), like a replay day in the demo; the import
   day stays the day of the first import (`first_done_at`), and games keep their rank (`seq`) so decisions on them
   hold.
3. **Decisions on the server** (done): `player_state`, one JSON value per key (`additions`, `ignored-checks`,
   `review`, `worked`), `GET /api/v2/state` and `PUT /api/v2/state/:key`. For an imported account the hooks read and
   write through `workshop/storage.ts`, saved 300 ms after a change and on `pagehide`; what the browser kept before
   goes up once. The demo stays in the browser. Next, per `CLAUDE.md`: `/` points to v2, then v1 is removed.
4. **Explorer ranges from the player's rating** (rule above in "Later").

## Later

- **Line view, next steps**: glossary entries for key position and decisive mistake.
- **Import** producing `PlayedGame` (Lichess OAuth is the decided auth; validate SAN
  there), then persistence. Same brick: the explorer ranges follow the player's Lichess rating
  (blitz or rapid, whichever has more games; 1800 when signed out) instead of the constants
  in `line/explorer.ts`: opponents from rating −100 to +300 rounded to the explorer's 200-point
  buckets, the player's own moves from rating +400 and never below 2000; the column label
  follows. Not before: until the import, the games shown are PMG's for everyone.
- **Engine signal on the whole tree** (priorities sorted into "a move to change" and
  "a position to work on" from the Openings screen): the line view does it per line only.
- **Design prototype** (`design-prototype/`, `/dev/flame-graph?variant=F…J`): the
  directions not chosen, kept for reference. They share the domain and `board/`, `flame/`,
  `workshop/` with the page; keep them compiling.
