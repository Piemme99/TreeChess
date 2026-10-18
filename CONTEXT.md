# TreeChess — Domain Context

A living glossary of the domain language. Terms here are meaningful to someone
reasoning about the product, not implementation details.

## Glossary

### Analyse-session

The ordered set of **New games** — games that are synced from a platform and not
yet viewed (the "New" badge in the Games tab, `synced && !viewed`) — across *all*
imports, stepped through in place without leaving the analysis view. The user
walks game-by-game (next/previous), inspecting opening adherence and enriching
the repertoire, with no return trip to a games list between games.

- **Scope:** all New games, regardless of which import they belong to.
  Navigation crosses analyses (each step may load a different `analysisId`). The
  list is fetched once as a stable snapshot (`/games?new=true`); it does not
  shift as games are marked viewed mid-session.
- **Anchoring:** the Games tab marks a game viewed on click-through, which would
  drop the entry game out of the New list — so the current game is always
  included in the session even when it is no longer New.
- **Navigation:** sequential through the snapshot (previous/next game), each
  game tagged with its status (New line / New opening / …); end of list shows a
  session recap. No "skip to interesting" jump.
- **Staleness after an in-place add is self-healing.** Every tree mutation
  already triggers an automatic, debounced (3s) re-analysis of the user's games
  (`ReanalysisQueue`). The session subscribes to re-analysis completion
  (`useReanalysisCompletion`) and refreshes its results when it lands; an
  optimistic local highlight gives instant feedback in the meantime. No manual
  "re-analyse" action is needed.
- Related: [Divergence](#divergence), [Add to repertoire](#add-to-repertoire-vs-open-in-repertoire).

### Divergence

The first move in a game that is not in the matched repertoire — status
`opponent-new` or `out-of-repertoire`. The natural starting point for an
"add to repertoire" action. A game with no divergence may still be extendable
from its first `out-of-book` move.

### Add to repertoire vs Open in repertoire

Two distinct actions on a game's move list:

- **Add to repertoire** — graft the line from the divergence to the clicked move
  onto the matched repertoire. The mass action, repeated many times per session.
  Happens **in place**: a direct API call, the user stays on the analysis view.
  Confirmation is a **rich toast** naming what was grafted and where, with an
  **Undo** (deletes the just-added nodes). No redirect.
- **Open in repertoire** — jump into the full repertoire editor focused on a
  position. The deliberate escape hatch when the user actually wants to edit the
  tree. This one still navigates away.

### Opening tree

The player's real games, for one side, merged move by move from the starting
position: each node is a line actually played, with the number of games that
went through it and the points the player scored there. Built from games, not
from a repertoire — it says what the player *does*, not what they intended.

- Only the first plies count (16 by default): beyond that, lines are too sparse
  to say anything.

### Deficit

How many points per game the player loses on a line compared to their own
average with that side. Positive means "you score less here than usual".
Smoothed toward zero on small samples (`games / (games + 12)`), so that a line
played seven times cannot dominate on noise. It is the colour of the flame
graph: it shows where points leak, not what the engine thinks.

### Priority

A line the player should work on first, drawn from both sides at once and
ranked by **points to gain**: a line ending on one of the player's moves where
they score significantly below their average (at least 20 games, gap beyond one
standard error), computed from results only (no engine). It says the player
plays the line badly — not that they should change openings: the choice of an
opening is theirs.

Weak lines are looked for on two time scales, because each kind of problem shows on
one only: an old problem, still there but rarely played, needs the **whole
history** to be proven; a recent one is drowned in the good old games and only
shows on the **last 12 months**. A line proven on the whole history is kept only
while still current — played in the last 12 months, and not scoring back at the
recent average there. A line and its sub-lines tell the same story: only the
heaviest is kept.

Only lines that survive sampling noise are shown: a priority list has no room
for "maybe".

### Points to gain

What a priority costs now, in game points (a win is 1, a draw ½): roughly how
many points the player lost on the line over the last 12 months compared to
their average, whatever proved the line a problem. Shown as a relative impact
bar.

### Worked line

A priority the player has acted on: accepting an addition from it dates the
line. From that date the priority reports [adherence](#adherence) first, then
the score against the score before, and leaves the list once the score is
proven back. Proven adherence with no gain says the problem lies after the
opening.

### Adherence

The share of the player's games through a line that followed their repertoire
to its end, or until the opponent left it. It shows whether a line is learned,
long before the score can show whether it pays.

### Repertoire

What the player intends to play, one per side: at each position where they are
to move, one or more moves, each a deliberate choice (alternating the Caro-Kann
and the Sicilian is a repertoire, not a mistake); at each position where the
opponent is to move, every reply the player keeps meeting, however rare at that
position: the player chooses their moves, they only meet the opponent's. It is the one object every step of the loop
reads and writes: created from the player's history, strengthened on their
priorities, enriched after each game. Creation keeps to the player's habits,
even those the engine judges bad (their replacement becomes a
[pending decision](#pending-decision)); going past their games is left to
strengthening and to additions. A move
leaves it only with the player's consent: one they have stopped playing (six
months without it while still reaching the position) is offered for removal, and
is left out of [spaced repetition](#spaced-repetition) meanwhile. Not to be confused with the
[opening tree](#opening-tree), which says what the player *does*.

_Avoid_: preparation (as a separate object), several repertoires per side.

### Game check

What happens after every real game the player finishes: the game is compared to
their repertoire, and a notification brings them back to it while it is
fresh. Two outcomes:

- **Left the repertoire** — the player played a move their repertoire does not
  hold ("move 7: you played Bd7, your repertoire has e6"). The check cannot tell
  a lapse from a new choice, so it asks instead of judging: **Add** (an
  [addition](#addition) built from there) or **Review** the
  repertoire's moves (an exercise on that position). Without an answer, nothing
  changes.
- **Not covered** — the opponent played a move the repertoire does not prepare.
  The player can add an answer or ignore it, like any game that left the
  repertoire. Met once, it may be chance: left alone, it does not wait for them;
  when the same move comes back, it becomes a [pending decision](#pending-decision).

A move outside the repertoire that the player keeps playing (a fifth of their
games there, over the last 12 months) is offered as an addition even if every
check was ignored.

A game that follows the repertoire to its end needs no check. It is the phone
side of Verify; [spaced repetition](#spaced-repetition) covers the days without
games. See ADR 0002.

### Addition

Moves the player adds to their [repertoire](#repertoire) by playing them on the
board, from the position a [game check](#game-check) raised: the move they want
to keep where they left the repertoire, or their answer to the opponent's
unexpected move, and as far beyond as they like. The product guides without
answering for them: at each position, one row per candidate move with what
players of their level play (share, score), the engine's evaluation of the
move, the engine's own move and their own games. Choosing, rather than
accepting a ready-made line, is how the moves are learned, and a main line the
player does not want is their call.

### Proposed addition

Moves the product drafts for a line, from the player's own habits rather than
from theory: at each position where they are to move, the moves they play
regularly — each replaced only where the engine judges it bad; opponent moves
from their games and the Lichess explorer at their rating, going on where their
games stop. Today it is the plan of the line view; the player builds an
[addition](#addition) instead of accepting one. See ADR 0002 (amended 2026-10-18).

_Avoid_: proposed preparation.

### Pending decision

Something the loop needs the player to settle: a [game check](#game-check)
(Add or Review), an addition, a habit the engine
offers to replace, or a move offered for removal from the
[repertoire](#repertoire). They wait together, newest first, each
naming the game that raised it — apart from [priorities](#priority), which are
long work ranked by points to gain.

### Spaced repetition

Replaying positions of the repertoire at growing intervals, so that it holds
on the days the player has no game to check. Positions the player recently got
wrong in a [game check](#game-check) come back first.
