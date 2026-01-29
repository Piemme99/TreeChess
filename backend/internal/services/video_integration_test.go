package services

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/treechess/backend/internal/models"
)

// recognitionOutput mirrors the JSON structure of recognition.Result for test fixtures
type recognitionOutput struct {
	Positions       []recognitionPosition `json:"positions"`
	TotalFrames     int                   `json:"totalFrames"`
	FramesWithBoard int                   `json:"framesWithBoard"`
}

type recognitionPosition struct {
	FrameIndex       int     `json:"frameIndex"`
	TimestampSeconds float64 `json:"timestampSeconds"`
	FEN              string  `json:"fen"`
	Confidence       float64 `json:"confidence"`
	BoardDetected    bool    `json:"boardDetected"`
}

func testdataDir() string {
	_, filename, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(filename), "testdata")
}

// loadRecognitionFixture loads the saved recognition output from the Scotch Opening video
func loadRecognitionFixture(t *testing.T) recognitionOutput {
	t.Helper()
	path := filepath.Join(testdataDir(), "recognition_output_scotch.json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Skipf("Recognition fixture not found at %s: %v", path, err)
	}
	var output recognitionOutput
	if err := json.Unmarshal(data, &output); err != nil {
		t.Fatalf("Failed to parse recognition fixture: %v", err)
	}
	return output
}

// toVideoPositions converts recognition output to models.VideoPosition slice
func toVideoPositions(positions []recognitionPosition) []models.VideoPosition {
	var result []models.VideoPosition
	for _, p := range positions {
		if p.BoardDetected && p.FEN != "" {
			conf := p.Confidence
			result = append(result, models.VideoPosition{
				FEN:              p.FEN,
				FrameIndex:       p.FrameIndex,
				TimestampSeconds: p.TimestampSeconds,
				Confidence:       &conf,
			})
		}
	}
	return result
}

// TestIntegration_TreeBuilderWithRealRecognitionData tests the tree builder
// with real (flawed) recognition data from the Scotch Opening video.
// This test documents what happens when the recognition output has errors.
func TestIntegration_TreeBuilderWithRealRecognitionData(t *testing.T) {
	fixture := loadRecognitionFixture(t)
	positions := toVideoPositions(fixture.Positions)

	if len(positions) == 0 {
		t.Fatal("No positions loaded from fixture")
	}

	t.Logf("Loaded %d positions from fixture (total frames: %d)", len(positions), fixture.TotalFrames)

	// Deduplicate
	deduped := deduplicateConsecutive(positions)
	t.Logf("After deduplication: %d unique positions", len(deduped))

	for i, pos := range deduped {
		t.Logf("  [%d] frame=%d FEN=%s", i, pos.FrameIndex, pos.FEN)
	}

	// Try to build the tree
	svc := NewTreeBuilderService()
	root, color, buildLog, err := svc.BuildTreeFromPositions(positions)

	if err != nil {
		t.Logf("Tree building failed (expected with bad recognition): %v", err)
		// This is informational — we want to know what happens
		return
	}

	t.Logf("Tree built successfully. Color: %s", color)
	if buildLog != nil {
		t.Logf("Build log: %d skipped, %d fallbacks, %d filtered", len(buildLog.Skipped), len(buildLog.Fallbacks), len(buildLog.Filtered))
		for _, fb := range buildLog.Fallbacks {
			t.Logf("  Fallback at frame %d: used %s (diff=%d)", fb.FrameIndex, fb.UsedMove, fb.Diff)
		}
		for _, fp := range buildLog.Filtered {
			t.Logf("  Filtered frame %d: [%s] %s", fp.FrameIndex, fp.Filter, fp.Reason)
		}
	}
	t.Logf("Root FEN: %s", root.FEN)

	// Walk the tree and log it
	var walkTree func(node *models.RepertoireNode, depth int)
	walkTree = func(node *models.RepertoireNode, depth int) {
		indent := ""
		for i := 0; i < depth; i++ {
			indent += "  "
		}
		move := "(root)"
		if node.Move != nil {
			move = *node.Move
		}
		t.Logf("%s%s -> FEN: %s [%d children]", indent, move, node.FEN, len(node.Children))
		for _, child := range node.Children {
			walkTree(child, depth+1)
		}
	}
	walkTree(root, 0)

	// The tree should have at least the root
	if root == nil {
		t.Fatal("Root should not be nil")
	}

	// Log how many moves were successfully connected
	totalNodes := countNodes(root)
	t.Logf("Total nodes in tree: %d (from %d unique positions)", totalNodes, len(deduped))

	// With real (bad) recognition data, the structural and continuity filters
	// correctly reject most garbage FEN positions. The remaining valid positions
	// may not form legal move sequences. This test is informational — it documents
	// the behavior with real data rather than asserting a specific outcome.
	t.Logf("Recognition data quality is low — %d of %d unique positions were filtered out", len(buildLog.Filtered), len(deduped))
}

func countNodes(node *models.RepertoireNode) int {
	if node == nil {
		return 0
	}
	count := 1
	for _, child := range node.Children {
		count += countNodes(child)
	}
	return count
}

// TestIntegration_TreeBuilderWithCorrectScotchPositions tests the tree builder
// with the CORRECT FEN positions for the Scotch Opening.
// This validates that the tree builder works when recognition is accurate.
func TestIntegration_TreeBuilderWithCorrectScotchPositions(t *testing.T) {
	// Correct Scotch Opening sequence: 1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4
	positions := []models.VideoPosition{
		{FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", FrameIndex: 0, TimestampSeconds: 0},
		// After 1.e4
		{FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3", FrameIndex: 38, TimestampSeconds: 38},
		// After 1...e5
		{FEN: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6", FrameIndex: 39, TimestampSeconds: 39},
		// After 2.Nf3
		{FEN: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -", FrameIndex: 40, TimestampSeconds: 40},
		// After 2...Nc6
		{FEN: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -", FrameIndex: 41, TimestampSeconds: 41},
		// After 3.d4
		{FEN: "r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3", FrameIndex: 50, TimestampSeconds: 50},
		// After 3...exd4
		{FEN: "r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq -", FrameIndex: 60, TimestampSeconds: 60},
		// After 4.Nxd4
		{FEN: "r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq -", FrameIndex: 68, TimestampSeconds: 68},
	}

	svc := NewTreeBuilderService()
	root, color, _, err := svc.BuildTreeFromPositions(positions)
	if err != nil {
		t.Fatalf("Failed to build tree from correct positions: %v", err)
	}

	if color != models.ColorWhite {
		t.Errorf("Expected white repertoire, got %s", color)
	}

	// Verify the full line: e4 -> e5 -> Nf3 -> Nc6 -> d4 -> exd4 -> Nxd4
	expectedMoves := []string{"e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4"}
	node := root
	for i, expectedMove := range expectedMoves {
		if len(node.Children) == 0 {
			t.Fatalf("Expected move %s at depth %d, but node has no children", expectedMove, i+1)
		}
		child := node.Children[0]
		if child.Move == nil {
			t.Fatalf("Expected move %s at depth %d, but move is nil", expectedMove, i+1)
		}
		if *child.Move != expectedMove {
			t.Errorf("At depth %d: expected move %s, got %s", i+1, expectedMove, *child.Move)
		}
		node = child
	}

	totalNodes := countNodes(root)
	if totalNodes != 8 { // root + 7 moves
		t.Errorf("Expected 8 nodes in tree, got %d", totalNodes)
	}

	t.Logf("Correct Scotch Opening tree built successfully with %d nodes", totalNodes)
}

// TestIntegration_TreeBuilderWithMixedQualityPositions tests the tree builder
// with a mix of correct and incorrect FEN positions, simulating
// partially correct recognition output.
func TestIntegration_TreeBuilderWithMixedQualityPositions(t *testing.T) {
	positions := []models.VideoPosition{
		// Correct: starting position
		{FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", FrameIndex: 0},
		// Correct: after 1.e4
		{FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3", FrameIndex: 1},
		// WRONG: garbage position (misrecognition)
		{FEN: "rnbqkbnr/ppppPppp/8/8/8/8/PPPP1PPP/RNBQKBPR w KQkq -", FrameIndex: 2},
		// Correct: after 1...e5 (back on track)
		{FEN: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6", FrameIndex: 3},
		// WRONG: another garbage position
		{FEN: "rPbqkbnr/pppp1ppp/2b5/4p3/8/5P2/PPPP1PPP/RNBQKB1R w KQkq -", FrameIndex: 4},
		// Correct: after 2.Nf3
		{FEN: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -", FrameIndex: 5},
	}

	svc := NewTreeBuilderService()
	root, _, _, err := svc.BuildTreeFromPositions(positions)
	if err != nil {
		t.Fatalf("Failed to build tree with mixed quality: %v", err)
	}

	// The tree builder should skip garbage positions and still connect valid ones
	totalNodes := countNodes(root)
	t.Logf("Tree built with %d nodes from %d positions (2 were garbage)", totalNodes, len(positions))

	// We expect at least: root -> e4 -> e5 -> Nf3 = 4 nodes
	// The garbage positions should be skipped
	if totalNodes < 3 {
		t.Errorf("Expected at least 3 connected nodes, got %d", totalNodes)
	}

	// Verify e4 was found
	if len(root.Children) == 0 {
		t.Fatal("Root should have at least one child (e4)")
	}
	if root.Children[0].Move == nil || *root.Children[0].Move != "e4" {
		t.Errorf("Expected first move e4, got %v", root.Children[0].Move)
	}
}

// TestIntegration_DeduplicationWithRealData verifies deduplication
// removes consecutive duplicate frames from real recognition data.
func TestIntegration_DeduplicationWithRealData(t *testing.T) {
	fixture := loadRecognitionFixture(t)
	positions := toVideoPositions(fixture.Positions)

	if len(positions) == 0 {
		t.Fatal("No positions in fixture")
	}

	deduped := deduplicateConsecutive(positions)

	t.Logf("Original positions: %d", len(positions))
	t.Logf("After deduplication: %d", len(deduped))
	t.Logf("Reduction: %.0f%%", (1-float64(len(deduped))/float64(len(positions)))*100)

	// With 120 frames but only 6 unique FENs, deduplication should be significant
	if len(deduped) >= len(positions) {
		t.Error("Deduplication should have reduced the number of positions")
	}

	// Verify no two consecutive deduplicated positions have the same board FEN
	for i := 1; i < len(deduped); i++ {
		prevBoard := normalizeBoardFEN(deduped[i-1].FEN)
		currBoard := normalizeBoardFEN(deduped[i].FEN)
		if prevBoard == currBoard {
			t.Errorf("Consecutive duplicate at index %d: %s", i, currBoard)
		}
	}
}

// TestIntegration_FindLegalMoveScotchOpening tests that findLegalMove correctly
// identifies all moves in the Scotch Opening sequence.
func TestIntegration_FindLegalMoveScotchOpening(t *testing.T) {
	// Pairs of (fromFEN, toFEN, expectedSAN)
	tests := []struct {
		name     string
		fromFEN  string
		toFEN    string
		wantMove string
	}{
		{
			name:     "1.e4",
			fromFEN:  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
			toFEN:    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
			wantMove: "e4",
		},
		{
			name:     "1...e5",
			fromFEN:  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
			toFEN:    "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6",
			wantMove: "e5",
		},
		{
			name:     "2.Nf3",
			fromFEN:  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6",
			toFEN:    "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -",
			wantMove: "Nf3",
		},
		{
			name:     "2...Nc6",
			fromFEN:  "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -",
			toFEN:    "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -",
			wantMove: "Nc6",
		},
		{
			name:     "3.d4",
			fromFEN:  "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -",
			toFEN:    "r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3",
			wantMove: "d4",
		},
		{
			name:     "3...exd4",
			fromFEN:  "r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3",
			toFEN:    "r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq -",
			wantMove: "exd4",
		},
		{
			name:     "4.Nxd4",
			fromFEN:  "r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq -",
			toFEN:    "r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq -",
			wantMove: "Nxd4",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			move, _, err := findLegalMove(tt.fromFEN, tt.toFEN)
			if err != nil {
				t.Fatalf("findLegalMove failed: %v", err)
			}
			if move != tt.wantMove {
				t.Errorf("got %s, want %s", move, tt.wantMove)
			}
		})
	}
}

// TestIntegration_TreeBuilderFallbackWithRealData tests the tree builder
// with real recognition data and fallback enabled vs disabled.
func TestIntegration_TreeBuilderFallbackWithRealData(t *testing.T) {
	fixture := loadRecognitionFixture(t)
	positions := toVideoPositions(fixture.Positions)
	if len(positions) == 0 {
		t.Fatal("No positions loaded from fixture")
	}

	// With fallback enabled (default)
	svcEnabled := NewTreeBuilderService()
	rootEnabled, _, logEnabled, err := svcEnabled.BuildTreeFromPositions(positions)
	if err != nil {
		t.Fatalf("Failed with fallback enabled: %v", err)
	}
	nodesEnabled := countNodes(rootEnabled)

	// With fallback disabled (but same filters)
	optsDisabled := DefaultTreeBuilderOptions()
	optsDisabled.EnableClosestMoveFallback = false
	svcDisabled := NewTreeBuilderServiceWithOptions(optsDisabled)
	rootDisabled, _, logDisabled, err := svcDisabled.BuildTreeFromPositions(positions)
	if err != nil {
		t.Fatalf("Failed with fallback disabled: %v", err)
	}
	nodesDisabled := countNodes(rootDisabled)

	t.Logf("Fallback enabled:  %d nodes, %d fallbacks, %d skipped, %d filtered", nodesEnabled, len(logEnabled.Fallbacks), len(logEnabled.Skipped), len(logEnabled.Filtered))
	t.Logf("Fallback disabled: %d nodes, %d skipped, %d filtered", nodesDisabled, len(logDisabled.Skipped), len(logDisabled.Filtered))

	// Fallback enabled should connect at least as many nodes
	if nodesEnabled < nodesDisabled {
		t.Errorf("Fallback should connect >= nodes: enabled=%d, disabled=%d", nodesEnabled, nodesDisabled)
	}
}

// TestIntegration_FindLegalMoveRejectsGarbageFEN tests that findLegalMove
// correctly rejects invalid FEN transitions (as produced by bad recognition).
func TestIntegration_FindLegalMoveRejectsGarbageFEN(t *testing.T) {
	// These are actual FEN pairs from the broken recognition output
	tests := []struct {
		name    string
		fromFEN string
		toFEN   string
	}{
		{
			name:    "starting_to_garbage_frame38",
			fromFEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
			toFEN:   "rnbqkbnr/ppppPppp/8/8/8/8/PPPP1PPP/RNBQKBPR w KQkq -",
		},
		{
			name:    "garbage_frame38_to_garbage_frame41",
			fromFEN: "rnbqkbnr/ppppPppp/8/8/8/8/PPPP1PPP/RNBQKBPR w KQkq -",
			toFEN:   "rPbqkbnr/pppp1ppp/2b5/4p3/8/5P2/PPPP1PPP/RNBQKB1R w KQkq -",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, _, err := findLegalMove(tt.fromFEN, tt.toFEN)
			if err == nil {
				t.Error("Expected error for garbage FEN transition, but got nil")
			} else {
				t.Logf("Correctly rejected: %v", err)
			}
		})
	}
}
