# 2. Verify lives on the phone, triggered by the player's games

Date: 2026-10-17

Status: Accepted

## Context

The v2 loop is **Spot → Understand → Prepare → Verify**. Understand and Prepare
are delegated to existing tools (local Stockfish, Lichess, master games); Spot
and Verify are the product. Verify — replaying one's preparation until it
sticks — is the differentiator: almost nobody does it, and it had never been
designed.

Progress in openings comes from repetition, and repetition needs a device the
player always carries. But the four steps do not share a device:

- **Spot** (flame graph, priorities) is occasional diagnosis over dense data:
  a large screen.
- **Understand / Prepare** is a long, focused session with an engine and an
  explorer: a large screen.
- **Verify** is two minutes, several times a day, on the go: a phone.

Cold onboarding also runs ~1,100 Stockfish WASM evaluations (95 s for 5,654
games, measured on the v2 POC). That is acceptable on a laptop and hostile on a
phone (heat, battery).

Players rarely go back over a game they just played, least of all to face the
opening mistakes in it. A tool that waits to be opened does not change that.

## Decision

1. **One product, two surfaces.** The workshop (Spot, Understand, Prepare) is
   designed for a computer; Verify is designed for a phone first. Both ship from
   the same React app.
2. **PWA first.** Installable, offline-capable, Web Push notifications (iOS
   requires the app to be installed on the home screen, 16.4+). Capacitor only
   if store presence becomes necessary; no native or React Native rewrite.
3. **Verify has two triggers:**
   - a **game check** after every real game, pushed as a notification
     ("move 7: you played Bd7, your preparation says e6"), which brings the
     player back to the game while it is fresh;
   - **spaced repetition** of the preparation, to fill the days without games.
4. **A game that leaves every preparation is still worth a notification.** It
   tells the player they have no preparation there and offers a **proposed
   preparation**.
5. **A proposed preparation starts from the player's own moves.** At each
   position where the player is to move, it keeps the move they habitually play,
   and replaces it only where the engine judges it bad. Opponent moves come from
   the player's games, completed by the Lichess explorer at their rating.
   *Amended 2026-10-18:* where the player's games stop, it goes on with what
   players of their level play — the move most played at their rating that the
   engine accepts, against the replies that are frequent at their rating — up to
   where their games are usually decided, not just where they stop overlapping.

   The original rule ("it stops where the player's games stop: completeness is
   coverage of real games, not move count") was dropped after the line view
   prototype (`frontend/src/features/openings/line-prototype/NOTES.md`): on the
   five real priorities, the player's games scatter one to three moves after the
   position where they start losing, while the decisive mistakes fall between
   moves 8 and 20. A preparation bounded by the player's games stopped at move 8
   and could not cover any of them; extended at their level, it reaches the
   position of a lost game (Philidor, 7…c5: 8.♘db5 where the game went 8.♘f5).

   *Amended 2026-10-18 (bis):* preparations become one **repertoire** per side
   (`CONTEXT.md`), and it may hold **several moves for the player** at a
   position: alternating openings is a choice, not a mistake. A proposed
   addition keeps every move the player plays regularly there (a fifth of their
   games over the last 12 months), not only the most played one.

   *Amended 2026-10-18 (ter):* when the repertoire is **created** from the
   player's history, a habit the engine judges bad is kept, and its replacement
   is offered as a pending decision instead of being imposed: the player has
   not chosen anything yet, and a silent swap would cut the habitual moves that
   follow and flag every later game as a deviation. Measured on 2025 games: one
   habit out of 78 (the Slav, 3…♗f5, ~7 pts). The engine still replaces bad
   habits inside an addition the player opens and accepts.

   *Amended 2026-10-18 (quater):* after a [game check](../../CONTEXT.md), the
   player **builds** the addition by playing it on the board instead of
   accepting a drafted one. The product guides — what players of their level
   play from each position, the engine's verdict on each of the player's moves
   once played, the engine's move only on request — but does not answer for
   them: choosing is how a line is learned, and a player may not want the main
   line. Tried and dropped the same day: a drafted tree (habits, then level
   moves, engine-checked) with branches to cut, judged to hand the answer
   ready-made. The draft remains the line view's plan.

### Rejected alternatives

- **Hand-written templates** (the v1 `repertoire_templates.go`: Italian, London,
  Scotch…). They ignore what the player plays and what they meet: a template
  can detail a Ruy López line nobody plays against them and miss the odd line
  they face three times a week.
- **Theory first** (master moves everywhere). Solid, but it rewrites habits
  even where nothing needs fixing, and makes the player relearn positions they
  already handle.
- **Best-scoring move at the player's rating.** Statistically noisy on rare
  lines, sometimes dubious by the engine.
- **Playing one's repertoire during onboarding** to build it (seen in another
  app, liked). Kept in mind, not adopted: it lengthens onboarding, and option 5
  already infers the same moves from the games. It may come back as a Verify
  exercise ("we think you play this here — play your move").
- **No notification without a preparation.** Coherent, but the phone stays
  silent for exactly the players who need it most: the new ones.

## Consequences

- **The server must act while the app is closed**: detect new games (Lichess
  streams a player's games in real time; chess.com only exposes archives that
  must be polled, with delay) and send Web Push (VAPID keys, one subscription
  per device).
- **The basic game check needs no engine**: comparing a game to a preparation
  is a tree walk, which the Go backend already does (`analysiscore`). Server-side
  evaluation is needed only to build a proposed preparation: to correct the
  player's moves, and to check the moves taken from the explorer beyond their games.
- **A proposed preparation needs the Lichess explorer**, which requires a Lichess
  token and is rate-limited (one request at a time, a minute's wait after a 429):
  it goes through the backend proxy with its cache (`GET /api/training/opening`)
  and the player's Lichess OAuth token.
- The flame graph stays a computer screen. On a phone, Spot shrinks to the
  priority list.
- Verify was mocked up on a phone before the workshop went further (branch
  `v2/mobile-verify`, `frontend/src/prototypes/mobile-verify/NOTES.md`). The
  "debrief" shape — understand the deviation, then replay it — is the baseline;
  playing before seeing the answer, and replaying whole lines, are left to test
  with real use. Moves are shown on a board with arrows, not in notation.
- Until Verify is built, the workshop must not rule it out: preparations are
  stored server-side (a few moves per position at most, comparable to a game
  while the app is closed), the player's habits are computed in a pure domain module, and the
  priority list works on a phone.
