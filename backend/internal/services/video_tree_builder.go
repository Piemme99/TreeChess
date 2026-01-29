package services

import (
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/notnil/chess"

	"github.com/treechess/backend/internal/models"
)

// TreeBuilderOptions configures the tree builder behavior
type TreeBuilderOptions struct {
	EnableClosestMoveFallback bool // default: true
	ClosestMoveMaxDiff        int  // default: 4
	EnableStructuralFilter    bool // default: true
	EnableContinuityFilter    bool // default: false (tree builder handles this via legal move validation)
	ContinuityMaxDiff         int  // default: 6
}

// DefaultTreeBuilderOptions returns the default options
func DefaultTreeBuilderOptions() TreeBuilderOptions {
	return TreeBuilderOptions{
		EnableClosestMoveFallback: true,
		ClosestMoveMaxDiff:        4,
		EnableStructuralFilter:    true,
		EnableContinuityFilter:    false,
		ContinuityMaxDiff:         6,
	}
}

// SkippedPosition records a position that couldn't be connected to the tree
type SkippedPosition struct {
	FrameIndex int
	FEN        string
	Reason     string
}

// FallbackMove records a position where the closest legal move fallback was used
type FallbackMove struct {
	FrameIndex int
	OriginalFEN string
	UsedMove    string
	ResultFEN   string
	Diff        int
}

// FilteredPosition records a position that was rejected by a pre-filter
type FilteredPosition struct {
	FrameIndex int
	FEN        string
	Filter     string // "structural" or "continuity"
	Reason     string
}

// TreeBuildLog collects diagnostics from the tree building process
type TreeBuildLog struct {
	Skipped   []SkippedPosition
	Fallbacks []FallbackMove
	Filtered  []FilteredPosition
}

// TreeBuilderService builds repertoire trees from sequences of video positions
type TreeBuilderService struct {
	opts TreeBuilderOptions
}

// NewTreeBuilderService creates a new tree builder service with default options
func NewTreeBuilderService() *TreeBuilderService {
	return &TreeBuilderService{opts: DefaultTreeBuilderOptions()}
}

// NewTreeBuilderServiceWithOptions creates a tree builder service with custom options
func NewTreeBuilderServiceWithOptions(opts TreeBuilderOptions) *TreeBuilderService {
	return &TreeBuilderService{opts: opts}
}

// BuildTreeFromPositions transforms a sequence of FEN positions into a repertoire tree
func (s *TreeBuilderService) BuildTreeFromPositions(positions []models.VideoPosition) (*models.RepertoireNode, models.Color, *TreeBuildLog, error) {
	if len(positions) == 0 {
		return nil, "", nil, fmt.Errorf("no positions provided")
	}

	buildLog := &TreeBuildLog{}

	// Step 1: Pre-filter positions (best-effort: fall back to unfiltered if all rejected)
	filtered := filterPositions(positions, s.opts, buildLog)
	if len(filtered) == 0 {
		filtered = positions
	}

	// Step 2: Deduplicate consecutive identical FENs
	deduped := deduplicateConsecutive(filtered)
	if len(deduped) == 0 {
		return nil, "", buildLog, fmt.Errorf("no valid positions after deduplication")
	}

	// Step 3: Build the tree with backtracking detection
	root, err := buildTree(deduped, s.opts, buildLog)
	if err != nil {
		return nil, "", buildLog, err
	}

	// Step 4: Detect color
	color := detectColor(root)

	return root, color, buildLog, nil
}

// filterPositions applies structural and continuity filters to reject bad FEN positions.
// Rejected positions are logged and excluded from the returned slice.
func filterPositions(positions []models.VideoPosition, opts TreeBuilderOptions, buildLog *TreeBuildLog) []models.VideoPosition {
	var result []models.VideoPosition
	var lastAcceptedBoard string

	for _, pos := range positions {
		board := normalizeBoardFEN(pos.FEN)

		if opts.EnableStructuralFilter {
			if reason, ok := validateStructuralFEN(board); !ok {
				buildLog.Filtered = append(buildLog.Filtered, FilteredPosition{
					FrameIndex: pos.FrameIndex,
					FEN:        pos.FEN,
					Filter:     "structural",
					Reason:     reason,
				})
				continue
			}
		}

		if opts.EnableContinuityFilter && lastAcceptedBoard != "" {
			diff := countBoardDiffs(lastAcceptedBoard, board)
			if diff > opts.ContinuityMaxDiff {
				buildLog.Filtered = append(buildLog.Filtered, FilteredPosition{
					FrameIndex: pos.FrameIndex,
					FEN:        pos.FEN,
					Filter:     "continuity",
					Reason:     fmt.Sprintf("too many diffs: %d (max %d)", diff, opts.ContinuityMaxDiff),
				})
				continue
			}
		}

		lastAcceptedBoard = board
		result = append(result, pos)
	}

	return result
}

// validateStructuralFEN checks that a FEN board string is structurally valid.
// Returns (reason, false) if invalid, ("", true) if valid.
func validateStructuralFEN(board string) (string, bool) {
	expanded := expandBoardFEN(board)
	if len(expanded) != 64 {
		return fmt.Sprintf("invalid board length: %d", len(expanded)), false
	}

	var whiteKings, blackKings int
	var whitePieces, blackPieces int
	var whitePawns, blackPawns int

	for i, ch := range expanded {
		if ch == '.' {
			continue
		}

		rank := i / 8 // 0 = rank 8, 7 = rank 1

		if ch >= 'A' && ch <= 'Z' {
			whitePieces++
			if ch == 'K' {
				whiteKings++
			}
			if ch == 'P' {
				whitePawns++
				if rank == 0 || rank == 7 {
					return fmt.Sprintf("white pawn on rank %d", 8-rank), false
				}
			}
		} else if ch >= 'a' && ch <= 'z' {
			blackPieces++
			if ch == 'k' {
				blackKings++
			}
			if ch == 'p' {
				blackPawns++
				if rank == 0 || rank == 7 {
					return fmt.Sprintf("black pawn on rank %d", 8-rank), false
				}
			}
		}
	}

	if whiteKings != 1 || blackKings != 1 {
		return fmt.Sprintf("invalid kings: K=%d, k=%d", whiteKings, blackKings), false
	}
	if whitePieces > 16 {
		return fmt.Sprintf("too many white pieces: %d", whitePieces), false
	}
	if blackPieces > 16 {
		return fmt.Sprintf("too many black pieces: %d", blackPieces), false
	}
	if whitePawns > 8 {
		return fmt.Sprintf("too many white pawns: %d", whitePawns), false
	}
	if blackPawns > 8 {
		return fmt.Sprintf("too many black pawns: %d", blackPawns), false
	}

	return "", true
}

// deduplicateConsecutive merges consecutive frames with the same FEN, keeping the first timestamp
func deduplicateConsecutive(positions []models.VideoPosition) []models.VideoPosition {
	if len(positions) == 0 {
		return nil
	}

	var result []models.VideoPosition
	prev := positions[0]

	for i := 1; i < len(positions); i++ {
		currentFEN := normalizeBoardFEN(positions[i].FEN)
		prevFEN := normalizeBoardFEN(prev.FEN)

		if currentFEN != prevFEN {
			result = append(result, prev)
			prev = positions[i]
		}
	}
	result = append(result, prev)

	return result
}

// normalizeBoardFEN extracts just the board part (first field) from a FEN string
// This is used for comparison since the video recognition can't determine side-to-move
func normalizeBoardFEN(fen string) string {
	parts := strings.Fields(fen)
	if len(parts) > 0 {
		return parts[0]
	}
	return fen
}

// buildTree constructs a RepertoireNode tree from deduplicated positions
func buildTree(positions []models.VideoPosition, opts TreeBuilderOptions, buildLog *TreeBuildLog) (*models.RepertoireNode, error) {
	if len(positions) == 0 {
		return nil, fmt.Errorf("no positions to build tree from")
	}

	// Create root node from starting position or first detected position
	startFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
	firstBoard := normalizeBoardFEN(positions[0].FEN)

	// Check if the first position is the starting position
	isStartPos := firstBoard == "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"
	if !isStartPos {
		// Use the first position as the root
		startFEN = positions[0].FEN
	}

	root := &models.RepertoireNode{
		ID:          uuid.New().String(),
		FEN:         normalizeFEN4(startFEN),
		Move:        nil,
		MoveNumber:  0,
		ColorToMove: getColorFromFEN(startFEN),
		ParentID:    nil,
		Children:    []*models.RepertoireNode{},
	}

	// Track visited FEN -> node mapping for backtracking
	fenToNode := map[string]*models.RepertoireNode{
		normalizeBoardFEN(root.FEN): root,
	}

	// Path stack for tracking current position in the tree
	currentNode := root

	startIdx := 0
	if isStartPos {
		startIdx = 1
	}

	for i := startIdx; i < len(positions); i++ {
		pos := positions[i]
		currentBoard := normalizeBoardFEN(pos.FEN)

		// Check if this position was already seen (backtracking)
		if existingNode, ok := fenToNode[currentBoard]; ok {
			currentNode = existingNode
			continue
		}

		// Try to find the legal move from current position to new position
		move, resultingFEN, err := findLegalMove(currentNode.FEN, pos.FEN)
		if err != nil {
			// Can't find a legal move - might be a jump or bad recognition
			// Try to find a parent node that can reach this position
			found := false
			for fenStr, node := range fenToNode {
				_ = fenStr
				m, rFEN, e := findLegalMove(node.FEN, pos.FEN)
				if e == nil {
					currentNode = node
					move = m
					resultingFEN = rFEN
					found = true
					break
				}
			}
			if !found {
				// Fallback: try closest legal move from current node
				if opts.EnableClosestMoveFallback {
					closestMove, closestFEN, diff, closestErr := findClosestLegalMove(currentNode.FEN, pos.FEN, opts.ClosestMoveMaxDiff)
					if closestErr == nil {
						move = closestMove
						resultingFEN = closestFEN
						buildLog.Fallbacks = append(buildLog.Fallbacks, FallbackMove{
							FrameIndex:  pos.FrameIndex,
							OriginalFEN: pos.FEN,
							UsedMove:    closestMove,
							ResultFEN:   closestFEN,
							Diff:        diff,
						})
					} else {
						// Skip this position - can't connect it even with fallback
						buildLog.Skipped = append(buildLog.Skipped, SkippedPosition{
							FrameIndex: pos.FrameIndex,
							FEN:        pos.FEN,
							Reason:     "no legal move or close fallback found",
						})
						continue
					}
				} else {
					// Fallback disabled - skip
					buildLog.Skipped = append(buildLog.Skipped, SkippedPosition{
						FrameIndex: pos.FrameIndex,
						FEN:        pos.FEN,
						Reason:     "no legal move found (fallback disabled)",
					})
					continue
				}
			}
		}

		// Check if this move already exists as a child
		var existingChild *models.RepertoireNode
		for _, child := range currentNode.Children {
			if child.Move != nil && *child.Move == move {
				existingChild = child
				break
			}
		}

		if existingChild != nil {
			currentNode = existingChild
			fenToNode[currentBoard] = existingChild
			continue
		}

		// Create new node
		moveNumber := calculateMoveNumber(currentNode)
		parentID := currentNode.ID

		newNode := &models.RepertoireNode{
			ID:          uuid.New().String(),
			FEN:         normalizeFEN4(resultingFEN),
			Move:        &move,
			MoveNumber:  moveNumber,
			ColorToMove: getColorFromFEN(resultingFEN),
			ParentID:    &parentID,
			Children:    []*models.RepertoireNode{},
		}

		currentNode.Children = append(currentNode.Children, newNode)
		fenToNode[currentBoard] = newNode
		currentNode = newNode
	}

	return root, nil
}

// findLegalMove finds the SAN notation of the legal move that transforms fromFEN to toFEN
func findLegalMove(fromFEN, toFEN string) (string, string, error) {
	fullFromFEN := ensureFullFEN6(fromFEN)
	targetBoard := normalizeBoardFEN(toFEN)

	fenFn, err := chess.FEN(fullFromFEN)
	if err != nil {
		return "", "", fmt.Errorf("invalid source FEN: %w", err)
	}

	game := chess.NewGame(fenFn)
	validMoves := game.ValidMoves()

	for _, move := range validMoves {
		// Try each legal move and check if resulting position matches
		testGame := chess.NewGame(fenFn)
		if err := testGame.Move(move); err != nil {
			continue
		}

		resultFEN := testGame.Position().String()
		resultBoard := normalizeBoardFEN(resultFEN)

		if resultBoard == targetBoard {
			// Found the move
			san := chess.AlgebraicNotation{}.Encode(game.Position(), move)
			return san, normalizeFEN4(resultFEN), nil
		}
	}

	return "", "", fmt.Errorf("no legal move found from %s to %s", normalizeBoardFEN(fromFEN), targetBoard)
}

// detectColor determines the repertoire color based on the first move direction
func detectColor(root *models.RepertoireNode) models.Color {
	if len(root.Children) == 0 {
		return models.ColorWhite
	}

	// If the root is the standard starting position and the first move is by white,
	// the user is probably studying white
	if root.ColorToMove == models.ChessColorWhite {
		return models.ColorWhite
	}
	return models.ColorBlack
}

// calculateMoveNumber calculates the move number for a new node
func calculateMoveNumber(parent *models.RepertoireNode) int {
	if parent.ColorToMove == models.ChessColorBlack {
		return parent.MoveNumber + 1
	}
	return parent.MoveNumber
}

// getColorFromFEN extracts the color to move from a FEN string
func getColorFromFEN(fen string) models.ChessColor {
	parts := strings.Fields(fen)
	if len(parts) >= 2 && parts[1] == "b" {
		return models.ChessColorBlack
	}
	return models.ChessColorWhite
}

// normalizeFEN4 normalizes a FEN to 4 fields (board, turn, castling, en passant)
func normalizeFEN4(fen string) string {
	parts := strings.Fields(fen)
	if len(parts) >= 4 {
		return strings.Join(parts[:4], " ")
	}
	return fen
}

// ensureFullFEN6 ensures a FEN has all 6 fields
func ensureFullFEN6(fen string) string {
	parts := strings.Fields(fen)
	if len(parts) >= 6 {
		return fen
	}
	if len(parts) == 4 {
		return fen + " 0 1"
	}
	if len(parts) == 1 {
		return fen + " w KQkq - 0 1"
	}
	return fen + " 0 1"
}

// expandBoardFEN expands a FEN board string into a 64-character string
// where each character represents a square (piece letter or '.' for empty)
func expandBoardFEN(board string) string {
	var result strings.Builder
	result.Grow(64)
	for _, ch := range board {
		if ch == '/' {
			continue
		}
		if ch >= '1' && ch <= '8' {
			for i := 0; i < int(ch-'0'); i++ {
				result.WriteByte('.')
			}
		} else {
			result.WriteRune(ch)
		}
	}
	return result.String()
}

// countBoardDiffs counts the number of squares that differ between two FEN board strings
func countBoardDiffs(boardA, boardB string) int {
	a := expandBoardFEN(boardA)
	b := expandBoardFEN(boardB)
	if len(a) != 64 || len(b) != 64 {
		return 64 // invalid FEN, return max diff
	}
	diffs := 0
	for i := 0; i < 64; i++ {
		if a[i] != b[i] {
			diffs++
		}
	}
	return diffs
}

// findClosestLegalMove finds the legal move from fromFEN whose resulting board
// is closest to the target toFEN board. Returns the move, resulting FEN, diff count, and error.
// Only returns a match if the diff is <= maxDiff.
func findClosestLegalMove(fromFEN, toFEN string, maxDiff int) (string, string, int, error) {
	fullFromFEN := ensureFullFEN6(fromFEN)
	targetBoard := normalizeBoardFEN(toFEN)

	fenFn, err := chess.FEN(fullFromFEN)
	if err != nil {
		return "", "", 0, fmt.Errorf("invalid source FEN: %w", err)
	}

	game := chess.NewGame(fenFn)
	validMoves := game.ValidMoves()

	bestMove := ""
	bestFEN := ""
	bestDiff := maxDiff + 1

	for _, move := range validMoves {
		testGame := chess.NewGame(fenFn)
		if err := testGame.Move(move); err != nil {
			continue
		}

		resultFEN := testGame.Position().String()
		resultBoard := normalizeBoardFEN(resultFEN)

		diff := countBoardDiffs(resultBoard, targetBoard)
		if diff < bestDiff {
			bestDiff = diff
			bestMove = chess.AlgebraicNotation{}.Encode(game.Position(), move)
			bestFEN = normalizeFEN4(resultFEN)
		}
	}

	if bestMove == "" || bestDiff > maxDiff {
		return "", "", 0, fmt.Errorf("no legal move within %d diffs from %s to %s", maxDiff, normalizeBoardFEN(fromFEN), targetBoard)
	}

	return bestMove, bestFEN, bestDiff, nil
}
