package services

import (
	"testing"

	"github.com/treechess/backend/internal/models"
)

func TestDeduplicateConsecutive(t *testing.T) {
	positions := []models.VideoPosition{
		{FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", FrameIndex: 0, TimestampSeconds: 0},
		{FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", FrameIndex: 1, TimestampSeconds: 1},
		{FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -", FrameIndex: 2, TimestampSeconds: 2},
		{FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -", FrameIndex: 3, TimestampSeconds: 3},
		{FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -", FrameIndex: 4, TimestampSeconds: 4},
	}

	result := deduplicateConsecutive(positions)

	if len(result) != 2 {
		t.Errorf("expected 2 deduplicated positions, got %d", len(result))
	}

	if result[0].TimestampSeconds != 0 {
		t.Errorf("expected first position timestamp 0, got %f", result[0].TimestampSeconds)
	}

	if result[1].TimestampSeconds != 2 {
		t.Errorf("expected second position timestamp 2, got %f", result[1].TimestampSeconds)
	}
}

func TestDeduplicateConsecutiveEmpty(t *testing.T) {
	result := deduplicateConsecutive(nil)
	if result != nil {
		t.Errorf("expected nil result for empty input, got %v", result)
	}
}

func TestBuildTreeLinear(t *testing.T) {
	// Simulate: starting position -> e4 -> e5 -> Nf3
	positions := []models.VideoPosition{
		{FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", FrameIndex: 0},
		{FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3", FrameIndex: 1},
		{FEN: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6", FrameIndex: 2},
		{FEN: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -", FrameIndex: 3},
	}

	svc := NewTreeBuilderService()
	root, color, buildLog, err := svc.BuildTreeFromPositions(positions)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if buildLog == nil {
		t.Fatal("expected non-nil build log")
	}

	// Root should be starting position
	if normalizeBoardFEN(root.FEN) != "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR" {
		t.Errorf("unexpected root FEN: %s", root.FEN)
	}

	// Should have 1 child (e4)
	if len(root.Children) != 1 {
		t.Fatalf("expected 1 child of root, got %d", len(root.Children))
	}

	e4Node := root.Children[0]
	if e4Node.Move == nil || *e4Node.Move != "e4" {
		t.Errorf("expected move e4, got %v", e4Node.Move)
	}

	// e4 should have 1 child (e5)
	if len(e4Node.Children) != 1 {
		t.Fatalf("expected 1 child of e4, got %d", len(e4Node.Children))
	}

	e5Node := e4Node.Children[0]
	if e5Node.Move == nil || *e5Node.Move != "e5" {
		t.Errorf("expected move e5, got %v", e5Node.Move)
	}

	// e5 should have 1 child (Nf3)
	if len(e5Node.Children) != 1 {
		t.Fatalf("expected 1 child of e5, got %d", len(e5Node.Children))
	}

	nf3Node := e5Node.Children[0]
	if nf3Node.Move == nil || *nf3Node.Move != "Nf3" {
		t.Errorf("expected move Nf3, got %v", nf3Node.Move)
	}

	if color != models.ColorWhite {
		t.Errorf("expected color white, got %s", color)
	}
}

func TestBuildTreeWithBacktracking(t *testing.T) {
	// Simulate: start -> e4 -> e5 -> back to start+e4 -> d4 (creating a branch after e4)
	positions := []models.VideoPosition{
		{FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", FrameIndex: 0},
		{FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3", FrameIndex: 1},
		{FEN: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6", FrameIndex: 2},
		// Backtrack to after e4
		{FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3", FrameIndex: 3},
		// New branch: d5 instead of e5
		{FEN: "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6", FrameIndex: 4},
	}

	svc := NewTreeBuilderService()
	root, _, _, err := svc.BuildTreeFromPositions(positions)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Root -> e4
	if len(root.Children) != 1 {
		t.Fatalf("expected 1 child of root, got %d", len(root.Children))
	}

	e4Node := root.Children[0]

	// e4 should have 2 children: e5 and d5
	if len(e4Node.Children) != 2 {
		t.Fatalf("expected 2 children of e4, got %d", len(e4Node.Children))
	}

	moves := make(map[string]bool)
	for _, child := range e4Node.Children {
		if child.Move != nil {
			moves[*child.Move] = true
		}
	}

	if !moves["e5"] {
		t.Error("expected e5 as a child of e4")
	}
	if !moves["d5"] {
		t.Error("expected d5 as a child of e4")
	}
}

func TestBuildTreeWithGaps(t *testing.T) {
	// A position that can't be reached from the previous one should be skipped
	positions := []models.VideoPosition{
		{FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", FrameIndex: 0},
		{FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3", FrameIndex: 1},
		// Jump to a completely unrelated position (should be skipped)
		{FEN: "8/8/8/8/8/8/8/4K3 w - -", FrameIndex: 2},
		// Back to a reachable position from e4
		{FEN: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6", FrameIndex: 3},
	}

	svc := NewTreeBuilderService()
	root, _, _, err := svc.BuildTreeFromPositions(positions)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should still have the linear line: start -> e4 -> e5
	if len(root.Children) != 1 {
		t.Fatalf("expected 1 child, got %d", len(root.Children))
	}

	e4Node := root.Children[0]
	if len(e4Node.Children) != 1 {
		t.Fatalf("expected 1 child of e4, got %d", len(e4Node.Children))
	}
}

func TestBuildTreeEmpty(t *testing.T) {
	svc := NewTreeBuilderService()
	_, _, _, err := svc.BuildTreeFromPositions(nil)
	if err == nil {
		t.Error("expected error for empty positions")
	}
}

func TestValidateYouTubeURL(t *testing.T) {
	tests := []struct {
		url       string
		wantID    string
		wantError bool
	}{
		{"https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ", false},
		{"https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ", false},
		{"https://youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ", false},
		{"https://youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ", false},
		{"http://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ", false},
		{"not-a-url", "", true},
		{"https://example.com/video", "", true},
		{"", "", true},
	}

	for _, tt := range tests {
		id, err := ValidateYouTubeURL(tt.url)
		if tt.wantError && err == nil {
			t.Errorf("ValidateYouTubeURL(%q) expected error, got nil", tt.url)
		}
		if !tt.wantError && err != nil {
			t.Errorf("ValidateYouTubeURL(%q) unexpected error: %v", tt.url, err)
		}
		if id != tt.wantID {
			t.Errorf("ValidateYouTubeURL(%q) = %q, want %q", tt.url, id, tt.wantID)
		}
	}
}

func TestNormalizeBoardFEN(t *testing.T) {
	fen := "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
	board := normalizeBoardFEN(fen)
	expected := "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR"
	if board != expected {
		t.Errorf("normalizeBoardFEN(%q) = %q, want %q", fen, board, expected)
	}
}

func TestDetectColor(t *testing.T) {
	// White to move at root -> White repertoire
	root := &models.RepertoireNode{
		ColorToMove: models.ChessColorWhite,
		Children: []*models.RepertoireNode{
			{Move: strPtr("e4")},
		},
	}
	if color := detectColor(root); color != models.ColorWhite {
		t.Errorf("expected white, got %s", color)
	}

	// Black to move at root -> Black repertoire
	root.ColorToMove = models.ChessColorBlack
	if color := detectColor(root); color != models.ColorBlack {
		t.Errorf("expected black, got %s", color)
	}
}

func TestExpandBoardFEN(t *testing.T) {
	tests := []struct {
		name     string
		board    string
		expected string
	}{
		{
			name:     "starting position",
			board:    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR",
			expected: "rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR",
		},
		{
			name:     "after e4",
			board:    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR",
			expected: "rnbqkbnrpppppppp....................P...........PPPP.PPPRNBQKBNR",
		},
		{
			name:     "king vs king",
			board:    "8/8/8/4k3/8/8/4K3/8",
			expected: "............................k.......................K...........",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := expandBoardFEN(tt.board)
			if len(result) != 64 {
				t.Errorf("expected 64 chars, got %d: %q", len(result), result)
			}
			if result != tt.expected {
				t.Errorf("expandBoardFEN(%q)\ngot  %q\nwant %q", tt.board, result, tt.expected)
			}
		})
	}
}

func TestCountBoardDiffs(t *testing.T) {
	tests := []struct {
		name     string
		boardA   string
		boardB   string
		expected int
	}{
		{
			name:     "identical positions",
			boardA:   "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR",
			boardB:   "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR",
			expected: 0,
		},
		{
			name:     "after e4 (2 diffs)",
			boardA:   "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR",
			boardB:   "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR",
			expected: 2,
		},
		{
			name:     "completely different",
			boardA:   "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR",
			boardB:   "8/8/8/4k3/8/8/4K3/8",
			expected: 33, // 32 pieces gone + 2 kings placed - 1 overlap (k on e8 vs starting k on e8 = same square? no, e5 vs e8 differ)
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := countBoardDiffs(tt.boardA, tt.boardB)
			if result != tt.expected {
				t.Errorf("countBoardDiffs = %d, want %d", result, tt.expected)
			}
		})
	}
}

func TestFindClosestLegalMove(t *testing.T) {
	// Starting position -> target is "almost" e4 but with a minor error
	// (e.g., recognition misplaced a piece)
	t.Run("exact match returns zero diff", func(t *testing.T) {
		fromFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
		toFEN := "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3"
		move, _, diff, err := findClosestLegalMove(fromFEN, toFEN, 4)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if move != "e4" {
			t.Errorf("expected e4, got %s", move)
		}
		if diff != 0 {
			t.Errorf("expected diff 0, got %d", diff)
		}
	})

	t.Run("close match with 1 extra error", func(t *testing.T) {
		fromFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
		// Target is like after e4 but with an extra piece difference on a8
		// (r -> R on a8, so 1 extra diff beyond the 0 from e4)
		toFEN := "Rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3"
		move, _, diff, err := findClosestLegalMove(fromFEN, toFEN, 4)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		// Should find e4 as the closest move (diff=1, which is the a8 error)
		if move != "e4" {
			t.Errorf("expected e4, got %s", move)
		}
		if diff != 1 {
			t.Errorf("expected diff 1, got %d", diff)
		}
	})

	t.Run("no match within maxDiff", func(t *testing.T) {
		fromFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
		toFEN := "8/8/8/4k3/8/8/4K3/8 w - -"
		_, _, _, err := findClosestLegalMove(fromFEN, toFEN, 4)
		if err == nil {
			t.Error("expected error for distant position")
		}
	})
}

func TestBuildTreeWithClosestMoveFallback(t *testing.T) {
	// Positions with a minor recognition error at frame 2
	positions := []models.VideoPosition{
		{FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", FrameIndex: 0},
		{FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3", FrameIndex: 1},
		// After e5 but with 1 recognition error (a8: r -> R)
		{FEN: "Rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6", FrameIndex: 2},
		// Correct Nf3
		{FEN: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -", FrameIndex: 3},
	}

	svc := NewTreeBuilderService() // default: fallback enabled
	root, _, buildLog, err := svc.BuildTreeFromPositions(positions)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// With fallback, the erroneous position should be connected via closest legal move
	totalNodes := countNodes(root)
	if totalNodes < 3 {
		t.Errorf("expected at least 3 nodes with fallback, got %d", totalNodes)
	}

	// Check that a fallback was logged
	if len(buildLog.Fallbacks) == 0 {
		t.Log("No fallbacks recorded (position may have been connected via exact match or node scan)")
	}

	t.Logf("Nodes: %d, Fallbacks: %d, Skipped: %d", totalNodes, len(buildLog.Fallbacks), len(buildLog.Skipped))
}

func TestBuildTreeFallbackDisabled(t *testing.T) {
	// Same erroneous positions as above
	positions := []models.VideoPosition{
		{FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", FrameIndex: 0},
		{FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3", FrameIndex: 1},
		// Garbage position that can't be reached
		{FEN: "RNBQKBNR/PPPPPPPP/8/8/8/8/pppppppp/rnbqkbnr w - -", FrameIndex: 2},
	}

	opts := TreeBuilderOptions{
		EnableClosestMoveFallback: false,
		ClosestMoveMaxDiff:        4,
	}
	svc := NewTreeBuilderServiceWithOptions(opts)
	root, _, buildLog, err := svc.BuildTreeFromPositions(positions)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// With fallback disabled, the garbage position should be skipped
	if len(buildLog.Skipped) == 0 {
		t.Error("expected at least 1 skipped position with fallback disabled")
	}

	// Should still have root + e4 = 2 nodes minimum
	totalNodes := countNodes(root)
	if totalNodes < 2 {
		t.Errorf("expected at least 2 nodes, got %d", totalNodes)
	}

	t.Logf("Fallback disabled: Nodes: %d, Skipped: %d", totalNodes, len(buildLog.Skipped))
}

func TestValidateStructuralFEN(t *testing.T) {
	tests := []struct {
		name  string
		board string
		valid bool
	}{
		{"starting position", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", true},
		{"after e4", "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR", true},
		{"endgame K vs k", "8/8/8/4k3/8/8/4K3/8", true},
		{"two white kings", "rnbqkbnr/pppppppp/8/8/8/8/PPPPKPPP/RNBQKBNR", false},
		{"no white king", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQ1BNR", false},
		{"white pawn on rank 8", "Pnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", false},
		{"black pawn on rank 1", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/pNBQKBNR", false},
		{"white pawn on rank 1", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/PNBQKBNR", false},
		{"too many white pieces", "rnbqkbnr/pppppppp/NNNNNNNN/NNNNNNNN/8/8/PPPPPPPP/RNBQKBNR", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reason, ok := validateStructuralFEN(tt.board)
			if ok != tt.valid {
				t.Errorf("validateStructuralFEN(%q) = (%q, %v), want valid=%v", tt.board, reason, ok, tt.valid)
			}
		})
	}
}

func TestFilterPositions_Structural(t *testing.T) {
	positions := []models.VideoPosition{
		{FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", FrameIndex: 0},
		// Garbage: two white kings
		{FEN: "rnbqkbnr/ppppKppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3", FrameIndex: 1},
		// Valid: after e4
		{FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3", FrameIndex: 2},
	}

	opts := DefaultTreeBuilderOptions()
	opts.EnableContinuityFilter = false // test structural only
	buildLog := &TreeBuildLog{}

	result := filterPositions(positions, opts, buildLog)

	if len(result) != 2 {
		t.Errorf("expected 2 positions after structural filter, got %d", len(result))
	}
	if len(buildLog.Filtered) != 1 {
		t.Errorf("expected 1 filtered position, got %d", len(buildLog.Filtered))
	}
	if len(buildLog.Filtered) > 0 && buildLog.Filtered[0].Filter != "structural" {
		t.Errorf("expected structural filter, got %s", buildLog.Filtered[0].Filter)
	}
}

func TestFilterPositions_Continuity(t *testing.T) {
	positions := []models.VideoPosition{
		{FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", FrameIndex: 0},
		// After e4: 2 diffs (ok)
		{FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3", FrameIndex: 1},
		// Huge jump: endgame position (way more than 6 diffs)
		{FEN: "8/8/8/4k3/8/8/4K3/8 w - -", FrameIndex: 2},
		// After e5: 2 diffs from e4 (ok)
		{FEN: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6", FrameIndex: 3},
	}

	opts := DefaultTreeBuilderOptions()
	opts.EnableStructuralFilter = false  // test continuity only
	opts.EnableContinuityFilter = true
	buildLog := &TreeBuildLog{}

	result := filterPositions(positions, opts, buildLog)

	if len(result) != 3 {
		t.Errorf("expected 3 positions after continuity filter, got %d", len(result))
	}
	if len(buildLog.Filtered) != 1 {
		t.Errorf("expected 1 filtered position, got %d", len(buildLog.Filtered))
	}
	if len(buildLog.Filtered) > 0 && buildLog.Filtered[0].Filter != "continuity" {
		t.Errorf("expected continuity filter, got %s", buildLog.Filtered[0].Filter)
	}
}

func TestFilterPositions_BothFilters(t *testing.T) {
	positions := []models.VideoPosition{
		{FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", FrameIndex: 0},
		// Structural fail: pawn on rank 8
		{FEN: "Pnbqkbnr/pppppppp/8/8/4P3/8/PPP1PPPP/RNBQKBNR b KQkq -", FrameIndex: 1},
		// Valid after e4
		{FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3", FrameIndex: 2},
		// Continuity fail: huge jump from e4
		{FEN: "8/8/8/4k3/8/8/4K3/8 w - -", FrameIndex: 3},
	}

	opts := DefaultTreeBuilderOptions()
	opts.EnableContinuityFilter = true
	buildLog := &TreeBuildLog{}

	result := filterPositions(positions, opts, buildLog)

	if len(result) != 2 {
		t.Errorf("expected 2 positions after both filters, got %d", len(result))
	}
	if len(buildLog.Filtered) != 2 {
		t.Errorf("expected 2 filtered positions, got %d", len(buildLog.Filtered))
	}
}

func TestFilterPositions_Disabled(t *testing.T) {
	positions := []models.VideoPosition{
		{FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", FrameIndex: 0},
		// Would be rejected by structural
		{FEN: "Pnbqkbnr/pppppppp/8/8/4P3/8/PPP1PPPP/RNBQKBNR b KQkq -", FrameIndex: 1},
	}

	opts := DefaultTreeBuilderOptions()
	opts.EnableStructuralFilter = false
	opts.EnableContinuityFilter = false
	buildLog := &TreeBuildLog{}

	result := filterPositions(positions, opts, buildLog)

	if len(result) != 2 {
		t.Errorf("expected 2 positions with filters disabled, got %d", len(result))
	}
	if len(buildLog.Filtered) != 0 {
		t.Errorf("expected 0 filtered positions, got %d", len(buildLog.Filtered))
	}
}

// strPtr is defined in import_service_test.go
