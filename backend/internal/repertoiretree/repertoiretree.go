// Package repertoiretree holds pure primitives for walking, searching and
// indexing repertoire trees. The functions here are free of any service or
// repository dependency so that both RepertoireService and the analysis
// services (import, dashboard, insights, training) can share a single
// implementation of tree traversal instead of each keeping a near-duplicate
// copy of find-by-id / find-by-FEN / index-building logic.
package repertoiretree

import (
	"strings"

	"github.com/kumquat/backend/internal/models"
)

// NormalizeFEN strips half-move and full-move counters from a FEN string,
// keeping only board, side to move, castling, and en passant fields. Board
// positions are compared on these four fields so that transpositions reached
// with different clocks still match.
func NormalizeFEN(fen string) string {
	parts := strings.Fields(fen)
	if len(parts) >= 4 {
		return strings.Join(parts[:4], " ")
	}
	return fen
}

// FindByID searches the tree for a node whose ID matches id, returning nil when
// no such node exists.
func FindByID(root *models.RepertoireNode, id string) *models.RepertoireNode {
	if root == nil {
		return nil
	}
	if root.ID == id {
		return root
	}
	for i := range root.Children {
		if found := FindByID(root.Children[i], id); found != nil {
			return found
		}
	}
	return nil
}

// FindByFEN searches the tree for the first node (pre-order depth-first) whose
// FEN matches fen, returning nil when no such node exists.
func FindByFEN(root *models.RepertoireNode, fen string) *models.RepertoireNode {
	if root == nil {
		return nil
	}
	if root.FEN == fen {
		return root
	}
	for _, child := range root.Children {
		if child != nil {
			if found := FindByFEN(child, fen); found != nil {
				return found
			}
		}
	}
	return nil
}

// BuildFENIndex walks a repertoire tree once and returns a map from FEN to the
// matching node. When several nodes share the same FEN (transpositions), the
// first node reached in a pre-order depth-first traversal wins, mirroring the
// match semantics of FindByFEN. Building the index once and reusing it across
// every game/move avoids the O(repertoires × moves × tree) full-tree recursion
// that FindByFEN incurs on each lookup.
func BuildFENIndex(root *models.RepertoireNode) map[string]*models.RepertoireNode {
	index := make(map[string]*models.RepertoireNode)
	var walk func(node *models.RepertoireNode)
	walk = func(node *models.RepertoireNode) {
		if node == nil {
			return
		}
		if _, exists := index[node.FEN]; !exists {
			index[node.FEN] = node
		}
		for _, child := range node.Children {
			walk(child)
		}
	}
	walk(root)
	return index
}

// HasChildMove reports whether node has a child whose move equals san.
func HasChildMove(node *models.RepertoireNode, san string) bool {
	if node == nil {
		return false
	}
	for _, child := range node.Children {
		if child != nil && child.Move != nil && *child.Move == san {
			return true
		}
	}
	return false
}

// ExpectedMove returns the SAN of the move the repertoire expects from a
// position, preferring the explicit main-line child and falling back to the
// first child by insertion order. This mirrors the frontend convention of
// `children.find(isMainLine) ?? children[0]` so that out-of-repertoire feedback
// never contradicts the user's chosen main line.
func ExpectedMove(node *models.RepertoireNode) string {
	if node == nil {
		return ""
	}
	var fallback *models.RepertoireNode
	for _, child := range node.Children {
		if child == nil || child.Move == nil {
			continue
		}
		if child.IsMainLine {
			return *child.Move
		}
		if fallback == nil {
			fallback = child
		}
	}
	if fallback != nil {
		return *fallback.Move
	}
	return ""
}

// CollectMoves walks the tree and records every "parentFEN|childMove"
// combination into moves. The key identifies a move that exists in the
// repertoire at a given position.
func CollectMoves(node *models.RepertoireNode, moves map[string]bool) {
	if node == nil {
		return
	}
	for _, child := range node.Children {
		if child == nil {
			continue
		}
		if child.Move != nil && *child.Move != "" {
			moves[node.FEN+"|"+*child.Move] = true
		}
		CollectMoves(child, moves)
	}
}

// FindBranch follows the game's moves through the repertoire tree and returns
// the BranchName of the deepest named ancestor node along the game's path. It
// replays the path through the tree until the game deviates (the first move
// that is not in-repertoire) or the tree ends.
func FindBranch(root *models.RepertoireNode, moves []models.MoveAnalysis) string {
	if root == nil {
		return ""
	}
	branchName := ""
	currentNode := root

	if currentNode.BranchName != nil && *currentNode.BranchName != "" {
		branchName = *currentNode.BranchName
	}

	for _, move := range moves {
		if move.Status != "in-repertoire" {
			break
		}

		var nextNode *models.RepertoireNode
		for _, child := range currentNode.Children {
			if child != nil && child.Move != nil && *child.Move == move.SAN {
				nextNode = child
				break
			}
		}

		if nextNode == nil {
			break
		}

		if nextNode.BranchName != nil && *nextNode.BranchName != "" {
			branchName = *nextNode.BranchName
		}

		currentNode = nextNode
	}

	return branchName
}
