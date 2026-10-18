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

## User path (grilled with PMG, 2026-10-18)

1. **A router on opening, two intentions, no more.** "I just played" (e.g. 10 April 2026:
   38 games, the positions to settle) and "I want to work" (the first priority). Every
   figure on it is a door, and every door leads to a position of the repertoire. Rejected:
   more entries (repertoire health, stats, game history): that is the v1 dashboard, six
   blocks each leading to its own screen.
2. **"I just played" opens a session, one position at a time**, the most frequent first,
   then "next" until "done for today", with a counter (3 / 20). It is the v1 analyse-session
   (`CONTEXT.md`), by position instead of by game. Rejected: a list of the positions to
   pick from, which is the Games page of today, barely shorter (10 April: 26 cards).
3. **A position in the session shows a board, one line of facts, two choices and "Skip".**
   Board: repertoire move green, played move grey. Facts: the moves' games today and over
   12 months, with their score. Choices where the player left the repertoire: "Keep" the
   played move (the addition is built on the same board, candidate table) or "Stay on" the
   repertoire's (review). Where the opponent did: "Prepare an answer". "Skip" postpones;
   the position comes back with the same deviation. Not on this screen: flame graph,
   priorities, the all-time / 12-month figures: they serve "I want to work".
4. **"I want to work" opens priority 1 on the same position screen**, not a list of five:
   board at the key position, the verdict as the line of facts, "Prepare what follows" (an
   addition from there, same board, same candidate table), "Practise on Lichess" as a
   secondary link, and "Next priority". Rejected: tickets, preview, then the line view:
   three more screens, and a work path unlike the one after games.
5. **The position screen is the repertoire browser.** Clicking a green arrow plays it and
   moves on, ← goes back, like the Lichess explorer; the session and the priorities only
   pick the starting position. The flame graph leaves the path (kept on its dev route as a
   reference). Rejected: a third entry "See my repertoire" opening the flame graph: a third
   world, coloured by deficit (what the player does, not what they intend), as dense as the
   diagnosis screen just set aside.
6. **One position screen, designed for a phone first** (390 px), widened on a computer. The
   player settles and builds where the notification found them, the game still fresh; on a
   phone the candidate table shrinks to the arrows and one short row per move. Amends ADR
   0002. Rejected: sorting only on the phone and building later on the computer: every
   decision taken twice, the second time cold.

## Rejected alternatives

- **An inbox of pending decisions as the centre.** It gives a daily path, but
  no shared object: the features would line up in a list again. It stays as an
  entry point (a "to decide" count) into the repertoire screen.
- **The opening tree (flame graph) as the centre.** It says what the player
  does, not what they intend; the decisions and additions have nowhere to land.

## Consequences

- Three screens: the router, the position screen, and the addition built on the latter.
  Openings (flame graph, tickets, board panel), Games (cards) and the line view leave the
  path; their parts move onto the position screen (verdict, candidate table, game check).
  The domain is unchanged (`repertoire.ts`, `gameCheck.ts`, `addition.ts`, `diagnosis.ts`):
  this is a reorganisation of screens, not of rules.
- A first try (2026-10-18) added a "Moves here" table to the Openings board panel; PMG
  rejected it: one more block on a dense screen is not a centre. Reverted.
- Roadmap bricks 5–7 (Review, worked lines, removals) wait until the position
  screen exists, so that they land on it instead of adding a page.
- ADR 0002 amended (sexies): the position screen is designed for a phone first.
