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
ranked by **points at stake**. Two signals feed it, both computed from results
only (no engine):

- **Weak line** — a line ending on one of the player's moves where they score
  significantly below their average (at least 40 games, gap beyond one standard
  error). A line and its sub-lines tell the same story: only the heaviest is kept.
- **No settled reply** — a position where the player alternates between replies
  that do not score the same. Two systems that work equally well are a choice,
  not a gap; and a reply is not recommended on a sample much smaller than the
  habit it would replace.

Only signals that survive sampling noise are shown: a priority list has no room
for "maybe".

### Points at stake

What a priority is worth, in game points (a win is 1, a draw ½): roughly how
many points the player would have scored on top had the line performed at their
average — or, for a position with no settled reply, had they always played their
best reply.
