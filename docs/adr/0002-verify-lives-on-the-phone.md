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
   the player's games, completed by the Lichess explorer at their rating. It
   stops where the player's games stop: completeness is coverage of real games,
   not move count.

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
  evaluation is needed only to correct the player's moves in a proposed
  preparation.
- The flame graph stays a computer screen. On a phone, Spot shrinks to the
  priority list.
- Verify was mocked up on a phone before the workshop went further (branch
  `v2/mobile-verify`, `frontend/src/prototypes/mobile-verify/NOTES.md`). The
  "debrief" shape — understand the deviation, then replay it — is the baseline;
  playing before seeing the answer, and replaying whole lines, are left to test
  with real use. Moves are shown on a board with arrows, not in notation.
- Until Verify is built, the workshop must not rule it out: preparations are
  stored server-side (one move per position, comparable to a game while the app
  is closed), the player's habits are computed in a pure domain module, and the
  priority list works on a phone.
