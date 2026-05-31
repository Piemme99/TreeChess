// Package analysiscore holds the single source of truth for move
// classification and repertoire matching used by every analysis path (PGN
// import, training analysis and bulk re-analysis). Before this package the
// classification switch and the best-match scorer were copied across three
// methods of ImportService, so a fix to one site (see commit f99a31b) could
// silently miss the others. Routing every caller through ClassifyMove and
// BestMatch keeps the rules in exactly one place.
package analysiscore

import (
	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repertoiretree"
)

// Move status strings returned by ClassifyMove. They match the values the
// frontend and repository layers expect.
const (
	StatusInRepertoire    = "in-repertoire"
	StatusOutOfRepertoire = "out-of-repertoire"
	StatusOpponentNew     = "opponent-new"
	StatusOutOfBook       = "out-of-book"
)

// Classification is the result of evaluating a single played move against the
// repertoire node reached just before it was played.
type Classification struct {
	// Status is one of the Status* constants.
	Status string
	// ExpectedMove is the SAN the repertoire expected instead, set only when a
	// user move deviates from the repertoire (StatusOutOfRepertoire).
	ExpectedMove string
}

// ClassifyMove is the single move-classification rule shared by every analysis
// path. Given the repertoire node reached before the move (nil when the
// position is not in the tree), whether the played move is in the repertoire,
// and whether it was the user's move, it returns the move status and any
// expected move.
//
//   - node nil or a leaf  -> out-of-book (the repertoire ended here)
//   - move found          -> in-repertoire
//   - user move, not found -> out-of-repertoire (with the expected move)
//   - opponent move, not found -> opponent-new
func ClassifyMove(node *models.RepertoireNode, san string, isUserMove bool) Classification {
	if node == nil || len(node.Children) == 0 {
		return Classification{Status: StatusOutOfBook}
	}

	if repertoiretree.HasChildMove(node, san) {
		return Classification{Status: StatusInRepertoire}
	}

	if isUserMove {
		return Classification{
			Status:       StatusOutOfRepertoire,
			ExpectedMove: repertoiretree.ExpectedMove(node),
		}
	}

	return Classification{Status: StatusOpponentNew}
}

// IsUserMove reports whether the move at the given ply (0-based) belongs to the
// user, given which color the user played.
func IsUserMove(ply int, userColor models.Color) bool {
	return (ply%2 == 0 && userColor == models.ColorWhite) ||
		(ply%2 == 1 && userColor == models.ColorBlack)
}

// IsOpponentFirstMove reports whether the move at the given ply (0-based) is the
// opponent's very first move. Black's opponent moves first (ply 0); white's
// opponent replies on ply 1.
func IsOpponentFirstMove(ply int, userColor models.Color) bool {
	return (ply == 0 && userColor == models.ColorBlack) ||
		(ply == 1 && userColor == models.ColorWhite)
}

// BestMatch[T] selects the highest-scoring repertoire from candidates using the
// supplied score function. It returns a pointer to the winning element and its
// score, or nil and 0 when there are no candidates or none is admissible (a
// negative score signals that a repertoire must not be matched to this game,
// e.g. because it does not cover the opponent's first move).
//
// This single generic scorer replaces the three near-identical
// findBestMatchingRepertoire* variants that previously lived on ImportService.
func BestMatch[T any](candidates []T, score func(*T) int) (*T, int) {
	if len(candidates) == 0 {
		return nil, 0
	}

	var best *T
	bestScore := -1
	for i := range candidates {
		s := score(&candidates[i])
		if s > bestScore {
			bestScore = s
			best = &candidates[i]
		}
	}

	if bestScore < 0 || best == nil {
		return nil, 0
	}
	return best, bestScore
}
