# 3. The repertoire is the central screen

Date: 2026-10-18

Status: Accepted

## Context

The v1 died of having no centre: repertoires, games, analysis, training and
explore were separate screens, each useful, with no path through them. The v2
was heading the same way. `CONTEXT.md` already calls the **repertoire** "the one
object every step of the loop reads and writes", yet no screen shows it:

- **Openings** (`/dev/flame-graph`) is centred on the opening tree — what the
  player does — with the repertoire as a rim on the tiles and green arrows.
- **Games** (`/dev/games`) is centred on the game of the day.
- **The line view** is centred on a priority.

The two pages do not link to each other, and each speaks about the same
positions without knowing what the other says. Measured on Piemme78's games
(repertoire created on 2025-12-31, the 530 games of 2026 replayed):

- **Black against 1.d4** is a priority twice (1.d4 d5: 8.1 pts, 1.d4 ♘f6:
  7.7 pts) on Openings. On Games, 21 games ask "left the repertoire at 1.d4:
  you played ♘f6, your repertoire has d5" and 25 of the 30 games through
  1.d4 d5 leave it further on. Neither screen mentions the other.
- 51 of the 174 decisions of 2026 fall on a priority line; Games never says so.
- The 174 decisions concern **58 positions** only. One of them, 1.e4 e5 2.♘f3
  ♘c6 as White, comes back 37 times (the player switched from 3.d4 to 3.♗b5 in
  April): one choice to make, shown as 37 cards.

## Decision

1. **The repertoire is the central screen**, one per side: the screen the
   player lands on and comes back to. The unit everything points at is a
   **position of the repertoire**.
2. **Each position carries what the other features know about it**: the moves
   of the repertoire, the moves actually played there and how they score (the
   flame graph becomes this layer, not a separate world), and what waits there
   (pending decisions, priorities).
3. **Every other feature is a door into a position of that screen**, and acts
   there:
   - a game check says where the game left the repertoire and opens that
     position; the addition is built there, on the same board;
   - a priority is a position marked on the repertoire; studying it (the line
     view) and extending it (an addition) start from it;
   - spaced repetition, later, replays positions of the repertoire.
4. **Pending decisions are grouped by position**, not by game: a position the
   player keeps leaving is one decision naming the games, not one per game.
5. **The promise** every feature must serve: *a repertoire that matches what I
   play, and that I actually know*. A feature that moves neither is out.

The user path: I play → the product shows where my repertoire held and where it
gave way → I settle it at that position → I drill it.

## Rejected alternatives

- **An inbox of pending decisions as the centre.** It gives a daily path, but
  no shared object: the features would line up in a list again. It stays as an
  entry point (a "to decide" count) into the repertoire screen.
- **The opening tree (flame graph) as the centre.** It says what the player
  does, not what they intend; the decisions and additions have nowhere to land.

## Consequences

- Openings becomes the repertoire screen; Games becomes a feed that sends to it.
  The domain is unchanged (`repertoire.ts`, `gameCheck.ts`, `addition.ts`):
  this is a reorganisation of screens, not of rules.
- Roadmap bricks 5–7 (Review, worked lines, removals) wait until the repertoire
  screen exists, so that they land on it instead of adding a page.
- ADR 0002 holds: the repertoire screen is the workshop, on a computer; the
  phone's game check opens a position of the repertoire.
