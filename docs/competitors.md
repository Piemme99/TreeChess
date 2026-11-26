# Competitors — what similar apps do, and what Kumquat could improve

Survey of 2026-11-26: five web searches in parallel (Lichess and its ecosystem, Chess.com and Aimchess, dedicated
repertoire trainers, tools analysing the player's own games and AI coaches, what players say on forums), plus the live
demo walked through at 390 px. Product decisions stay in `frontend/src/features/openings/README.md`; this file is a
backlog of ideas with their sources, not a plan.

Limits: Reddit could not be reached, several Lichess pages were blocked (read through search snippets), and most
features come from the vendors' own pages. Points marked *unverified* could not be confirmed.

## Where Kumquat stands

The niche "repertoire from your own games, checked after each game" filled up in 2026: ChessAtlas (iOS, flags the
first deviation, starter repertoire from your games, spaced repetition), Chessalyz (red marker where the game left the
prep, orange flag on uncovered opponent moves), OpeningScanner (weak spots and gaps from any username, open source),
Chess Lens (beta, weekly summary per opening), Chessbook (Lichess games watched live, deviations quizzed), and
Chess.com's "course check" (Game Review flags where a game left a course the player owns, since 2026-09-08).

Kumquat keeps two things nobody else has as such: **weak openings proven statistically** against the player's own
average (ChessTempo's performance colouring is the closest), and a repertoire **created from habits** and keyed by
position, without a course to buy first.

Already done, so not listed below: transpositions merged, practice from any position of the tree, opponent replies at
the player's level, review weighted towards the positions actually met, the last 12 months weighing more.

## Ideas

### A. Understanding, not only memorising

Players' first complaint, in almost every thread: lines memorised without their ideas are lost as soon as the
opponent deviates ([chess.com blog](https://www.chess.com/blog/nekochabo/why-opening-study-isnt-making-you-better),
[Zwischenzug](https://www.zwischenzug.gg/p/memorizing-without-understanding),
[chess.com forum](https://www.chess.com/forum/view/general/i-dont-get-chessable)).

1. **"Why this move?" in one line** (idea, threat, plan) next to the candidate tables. Knightly
   ([site](https://www.knightlychess.com)), Lotus Chess ([App Store](https://apps.apple.com/us/app/-/id6738741464)),
   DecodeChess (inactive since 2022).
2. **Personal notes per position**, shown during review. ChessTempo ([manual](https://chesstempo.com/manual/en/manual.html)
   §17), Listudy, Chessbook, Lichess studies.
3. **Model games on a weak opening**, with "guess the move", opened on Lichess. Chessbook
   ([review](https://64squares.substack.com/p/chessbook-review)), Lichess opening pages
   ([lichess.org/opening](https://lichess.org/opening)).
4. **Play on into the middlegame against Maia** (a human-like engine at a given rating) once the explorer runs out of
   games at the player's level. Maia platform
   ([post](https://github.com/CSSLab/maia-platform-frontend/blob/main/src/lib/blog/posts/platform-v1.md)), Noctie
   ([site](https://noctie.ai/)), ChessBase 27 ([announcement](https://en.chessbase.com/post/chessbase-27-all-new-functions)).
   Maia-3 runs in the browser and is open source.
5. **Puzzles from the player's own openings.** The Lichess puzzle database is tagged by opening and public domain
   ([lichess.org/training/openings](https://lichess.org/training/openings)); Chessboard Magic's "Repertoire Puzzles"
   (*unverified*).

### B. Finding the gaps before meeting them

6. **Coverage goal** ("an answer to every opponent move seen in at least 1 game in 200 at my level") and a "biggest gap"
   button. Chessbook ([vs Chessable](https://chessbook.com/blog/chessbook-vs-chessable)), Chessreps (gap = any reply
   played in ≥ 1 % of Lichess games), OpeningScanner "Gaps"
   ([blog](https://lichess.org/@/ChessAtlasApp/blog/i-built-a-free-tool-to-analyze-your-chess-openings-repertoire-weaknesses/UoOVBu2X)).
   Today Kumquat finds an uncovered reply only once a game or a practice game meets it. *Done on 2026-11-26* (`findGaps` in
   `domain/gaps.ts`, the Gaps task).
7. **Leave out of review the lines too rare at the player's level**, to keep the daily load small (a Chessbook user had
   100–200 moves a day to review). Chessbook "trim to coverage goal"
   ([vs Chessreps](https://chessbook.com/blog/chessbook-vs-chessreps)).
8. **Depth of preparation per opening**: "in the Caro-Kann you leave your repertoire at move 6". Chess.com Opening
   Insights ([news](https://www.chess.com/news/view/announcing-opening-insights)), Chessigma "Preparation"
   ([page](https://chessigma.com/supercoach)).
9. **Prepare against an opponent**: their openings compared with my repertoire. Lichess Player tab
   ([blog](https://lichess.org/blog/YXMPxxMAACEAy3g4/announcing-the-personal-opening-explorer)), Chess.com Explore tab
   ([news](https://www.chess.com/news/view/announcing-explore-tab)), ChessMonitor, Chessboard Magic "Dossiers"
   (*unverified*).

### C. The weak-opening diagnosis

10. **Account for the opponents' strength** (expected score from the rating gap), so a line met mostly against
    stronger players does not look weak. Lichess Insights (opponent-strength filter,
    [blog](https://lichess.org/@/lichess/blog/chess-insights/VmZbaigA)), Aimchess, OpeningScanner (average opponent
    rating). `PlayedGame` does not store the opponent's rating today.
11. **Share of games leaving the opening equal or better**, from Stockfish: tells a bad opening from a game lost later.
    Aimchess ([site](https://aimchess.com)), Lichess accuracy per phase (July 2026,
    [changelog](https://lichess.org/page/changelog)). Close to "Engine signal on the whole tree" in the README's Later.
12. **Filters by speed and period** (blitz vs rapid). Lichess explorer, ChessMonitor
    ([pricing](https://www.chessmonitor.com/pricing)). The speed is not stored today.
13. **Score curve after the work** on a worked line. ChessMonitor (time window, *unverified* "Worst" sort).
14. **Recurring mistakes** ("wrong here 4 times") and a list of stubborn moves to train on their own. ChessTempo
    "resistant moves", Chessable difficult moves, wished for in the
    [Chessbook review](https://64squares.substack.com/p/chessbook-review).
15. **Engine pass over the opening of the whole history**, not only new games. Chessboard Magic "Opening Inaccuracies"
    (*unverified*). Overlaps brick 7 of the README (engine correction at creation).

### D. Review (spaced repetition)

16. **A repertoire move played right in a game counts as a successful review.** About 20 % of Chessbook's reviews come
    from games ([vs Chessable](https://chessbook.com/blog/chessbook-vs-chessable)). *Done on 2026-11-26* (`withGames` in
    `domain/review.ts`).
17. **Retry before the answer** in Check: when the game left the repertoire, the player looks for the move before it
    is shown. Lichess "Learn from your mistakes"
    ([blog](https://lichess.org/@/lichess/blog/learn-from-your-mistakes/WFvLpiQA)), Chess.com Game Review "Retry"
    ([page](https://www.chess.com/terms/game-review)), Aimchess Opening Improver. *Done on 2026-11-26* (`recallOf` in
    `session/steps.ts`).
18. **A finer scheduler than three boxes** (1, 7, 30 days), e.g. FSRS. Chessbook, Chessreps, ChessAtlas, En Croissant
    ([GitHub](https://github.com/franciscoBSalgueiro/en-croissant)).
19. **On the way to a due position, ask the moves nearly due** instead of playing them automatically. ChessTempo
    "adaptive lead-up moves".
20. **Replay a missed line in the same session.** Listudy ([blog](https://listudy.org/en/blog/spaced-repetition-for-chess)).
21. **"Review this branch" and "everything in order" modes** (before a tournament). ChessTempo.
22. **"Review this line" from a Check step.** Chess.com course check "Study"
    ([news](https://www.chess.com/news/view/announcing-game-review-course-check)).
23. **Richer progress than "N% known"**: unseen / learning / learnt / due, a 7-day forecast, a memory colouring of the
    tree (next due, last seen). ChessTempo sunburst.

### E. Practice

24. **Hint and takeback during the game.** Noctie, Maia practice mode, Chess.com Play Coach
    ([news](https://www.chess.com/news/view/announcing-play-coach)).
25. **Replay a lost game from its critical opening move** against a bot. Chessigma "Bot Challenge".
26. **"You played like a 1500"** at the end. Maia.

### F. Coming back after a game, and every day

What keeps players: short daily sessions (~10 min); what makes them quit: a backlog that feels like homework
([chess.com forum](https://www.chess.com/forum/view/chess-openings/how-do-you-practice-your-opening-repertoire),
[Keda](https://juntaikeda.substack.com/p/3-lifetime-repertoires-the-10-pitfalls)).

27. **Notification right after a Lichess game ends.** Chessbook. Needs a PWA with push: Kumquat has a
    `site.webmanifest` but no service worker.
28. **Installable app and offline review.** ChessAtlas, Lichess mobile, Chessbook (offline "in development").
29. **A light streak** that never punishes a break, and a celebration when an opening becomes known. Chess.com streaks
    and Skills ([help](https://support.chess.com/en/articles/16243840-what-are-skills-on-chess-com)), ChessAtlas.
    Players distrust streak pressure ([Substack](https://mattplayschess.substack.com/p/1000-day-streak-on-chessable)).
30. **Daily or weekly digest** ("your 3 positions today"). Chessigma daily plan, Knightly, Chess Lens.

### G. Portability and acquisition

31. **Chess.com import.** Nearly every competitor has it, and PMG's history is there.
32. **PGN or Lichess-study export, study import** ("your repertoire is yours"). Chessbook, ChessTempo, Listudy,
    OpeningScanner. Whether Lichess grants study writing to Kumquat's OAuth scopes is *unverified*.
33. **Try on any Lichess username without signing in.** OpeningScanner
    ([GitHub](https://github.com/atamano/openingscanner)).
34. **A landing page that shows the result**: today one sentence and two buttons, no picture of what the player gets.
    Free, no cap and "only the lines you meet" are what players praise elsewhere.
35. **A shareable URL per view**, to send to a coach. Lichess Insights, Aimchess.
36. **Win/draw/loss bar** in the candidate table. Chess.com Explore tab.
37. **Translated UI.** Lichess is translated into dozens of languages.
38. *Rejected by `CONTEXT.md`*: several repertoires per side (Chessbook separates blitz and classical).

## Suggested order

1. **16** — cheap, pure (`domain/review.ts`, next to `withLapses`), and at the heart of the loop: the games already
   played lighten the review.
2. **17** — recalling beats reading, on the step players see after every game.
3. **6** — the explorer stats at the player's level are already there.
4. **31** — opens the app to Chess.com players, PMG's history included.
5. **1** — the most frequent complaint, but the hardest to do well.

## Products surveyed

Lichess (studies, explorer, insights, analysis, puzzles, mobile, Maia bots), OpeningTree, OpeningScanner, Listudy,
Chessbook, ChessMonitor, Chessboard Magic Repertoire Builder, Chessdriller (shut down), chessli; Chess.com (Game Review,
stats, Explore, courses and Repertoire, Practice, Play Coach), Aimchess; Chessable, ChessTempo, Chess Position Trainer,
Lucas Chess, Scid vs PC, ChessBase 26/27, Chessreps, ChessAtlas, Chess Prep Pro; Chessigma, Chess Insights
(chess-insights.com), Chessalyz, Chess Lens, Lotus Chess, Knightly, Noctie, Maia, En Croissant, DecodeChess, Chessify,
Dr. Wolf, Chesskit. "OpenChess" only matched an iOS app teaching named openings, without the player's games.
