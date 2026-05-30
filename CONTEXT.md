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
