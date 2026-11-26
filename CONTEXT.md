# TreeChess — Domain Context

A living glossary of the domain language. Terms here are meaningful to someone
reasoning about the product, not implementation details.

## Glossary

### Session

What the player goes through after playing: the positions where their recent games
left the [repertoire](#repertoire), one at a time, the most frequent first, each
settled or skipped. A position several games left the same way is one step, naming
those games.

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
they score significantly below their average (at least 10 games, gap beyond one
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

The player sees priorities as **weak openings** ("Weak opening 2 of 5"), the only name on screen.

### Points to gain

What a priority costs now, in game points (a win is 1, a draw ½): roughly how
many points the player lost on the line over the last 12 months compared to
their average, whatever proved the line a problem. Shown as a relative impact
bar only; the figure the player reads is the line's score against their average.

### Worked line

A priority the player has acted on: accepting an addition from it dates the
line. From that date the priority reports [adherence](#adherence) first, then
the score against the score before, and leaves the list once the score is
proven back. Proven adherence with no gain says the problem lies after the
opening. A worked line is no longer something to do: it comes back to
do only when the games played since the work prove it weak again, and meanwhile
leaves its place among the weak openings to do to the next one.

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
priorities, enriched after each game, and the central screen every other feature opens at one of its
positions. Creation keeps to the player's habits,
even those the engine judges bad (their replacement becomes a
[pending decision](#pending-decision)); going past their games is left to
strengthening and to additions. A move
leaves it only with the player's consent: they can remove one of their moves
(the line it opened leaves [spaced repetition](#spaced-repetition) with it, and
the games played with it before stay settled), and one they have stopped
playing (something else the last 5 times they reached the position) is offered
for removal, and is left out of spaced repetition meanwhile. Counted in games,
not in months: a player who stops playing loses nothing. A move the player
keeps instead comes back to review and is offered again only once they play it
again and then leave it the 5 following times (alternating two openings in
streaks is a repertoire). Adding a removed move again puts it back. Not to be confused with the
[opening tree](#opening-tree), which says what the player *does*.

_Avoid_: preparation (as a separate object), several repertoires per side.

### Game check

What happens after every real game the player finishes: the game is compared to
their repertoire, and a notification brings them back to it while it is
fresh. Two outcomes:

- **Left the repertoire** — the player played a move their repertoire does not
  hold ("move 7: you played Bd7, your repertoire has e6"). The engine compares
  that move with the repertoire's best one at that position. Weaker by at least an
  inaccuracy, it is a lapse: the player first looks for their repertoire move
  on the board, then answers **Add** (an [addition](#addition)
  built from there) or **Review** the repertoire's moves (an exercise on that
  position); without an answer, nothing changes. Not weaker, there is nothing to
  ask: played once, it is left alone; played again, it joins the repertoire by
  itself, announced with an undo.
- **Not covered** — the opponent played a move the repertoire does not prepare.
  The player can add an answer or ignore it, like any game that left the
  repertoire. Met once, it may be chance: left alone, it does not wait for them;
  when the same move comes back, it becomes a [pending decision](#pending-decision).
- **Gap** — a position where the opponents of the player's level bring them in at
  least 1 game in 200, if the player always plays their repertoire, and where the
  repertoire has no move of theirs. Read on the Lichess explorer, not in the
  player's games: a gap shows before a game meets it. The biggest comes first.

A move outside the repertoire that the player keeps playing (a fifth of their
games there, over the last 12 months) is offered as an addition even if every
check was ignored.

A game that follows the repertoire to its end needs no check. It is the phone
side of Verify; [spaced repetition](#spaced-repetition) covers the days without
games.

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
games stop. It was the plan of the line view (deleted); the player builds an
[addition](#addition) instead of accepting one.

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
wrong in a [game check](#game-check) come back first. Games review too: a due
position where the player plays their repertoire move in a game counts as a
right answer, so what their games prove is not asked again.

### Mastery

How much of the [repertoire](#repertoire) the player knows, shown as "N% known".
Each position where they are to move counts its [spaced repetition](#spaced-repetition)
box out of three: never reviewed or last missed (in review or in a game) counts
nothing, three right answers in a row at growing intervals make it fully known. A position whose review is overdue counts one box less until it
is answered again, so the figure drops when the player stops reviewing. Every
position weighs the same.

_Avoid_: progress, score (the score is the points scored in games).
