# 1. Importing Lichess study chapters with custom starting positions

Date: 2026-05-28

Status: Accepted

## Context

Lichess studies often use the "From Position" feature: a chapter declares
`[SetUp "1"]` + `[FEN "..."]` to start from a specific midgame position rather
than the standard starting position. Until now `ParsePGNToTree` rejected such
chapters (`ErrCustomStartingPosition`) and the study importer skipped them,
surfacing the skip to the user (issue #37). Issue #78 asks whether and how to
actually import them.

A repertoire's move tree is implicitly rooted at the standard starting position.
An audit of the consumers of that assumption found that almost everything is
already FEN-agnostic — it walks the tree by the FEN stored on each node:

- **Game-analysis adherence** replays the *game* from the standard start (real
  games do start there) and matches each position against the repertoire tree by
  **EPD** — `normalizeFEN` keeps board + side-to-move + castling + en-passant and
  drops the move counters. A repertoire rooted at a midgame position therefore
  matches a game automatically once the game transposes into the root position.
  No change needed.
- **Transposition detection, move numbering, the tree model and DB schema** are
  all FEN-relative. No change needed.
- **Repertoire creation** hard-codes the root FEN, but study import builds the
  tree directly from the parser, bypassing that path.
- **Training** hard-codes the initial board FEN to the standard start.

## Decision

Support custom-start chapters via a **per-chapter repertoire**: each such chapter
becomes its own repertoire whose **root node is the chapter's starting FEN**.

1. **Parser.** `ParsePGNToTree` keeps rejecting custom starts (used by the merge
   path and existing callers). A new `ParseChapterPGNToTree` allows a custom
   start: it builds the game from the `[FEN]` header and roots the tree there.
   `cloneGame` / `replayToNode` now preserve the game's starting position instead
   of assuming the standard one.
2. **Per-chapter import** uses `ParseChapterPGNToTree`, so custom-start chapters
   are imported instead of skipped.
3. **Merged import** still skips custom-start chapters — they cannot be grafted
   onto a single standard-rooted tree — and reports them in `skipped`.
4. **Preview** marks custom-start chapters `importable: true` with a
   `customStart: true` flag; the UI shows a "custom start" badge, imports them in
   per-chapter mode, and excludes them from the merge payload.
5. **Training** derives the initial board FEN from the repertoire root
   (`ensureFullFEN(treeRoot.fen)`) instead of the hard-coded standard start, so
   custom-rooted repertoires are trainable. For standard repertoires this is
   identical to the previous behaviour.

### Rejected alternatives

- **Merge-graft onto the main tree** when the chapter FEN is reachable from the
  start: reachability detection is unreliable (non-standard castling rights and
  move counters, e.g. the example study's chapter 3), risking wrong grafts.
- **Repairing the root FEN** (recomputing castling rights from piece placement):
  deferred — see the limitation below. We import the chapter FEN verbatim.

## Consequences

- Custom-start chapters import and are viewable, editable and trainable as their
  own repertoires.
- **Move numbers are relative to the chapter** (the first played move is move 1),
  not the original game's move numbers. This is intentional: Lichess "From
  Position" FENs carry arbitrary full-move counters (the example chapter 3 says
  move 7) that would otherwise display misleadingly.
- **Game-analysis adherence works only when the chapter's root FEN has correct
  castling / en-passant rights.** "From Position" setups sometimes carry
  inconsistent castling rights (e.g. `kq` for a position where no king or rook
  has moved). Because every descendant FEN inherits the root's castling field and
  matching is by EPD, such a repertoire will not match real games (which carry
  the correct rights). We import the FEN verbatim and accept this limitation;
  repairing the root FEN's castling/en-passant from piece placement is a possible
  future enhancement.
- The merge import is unchanged for users; custom-start chapters remain skipped
  there and are surfaced as before.
