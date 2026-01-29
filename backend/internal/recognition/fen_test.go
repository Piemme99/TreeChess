package recognition

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseFENBoard_StartingPosition(t *testing.T) {
	grid := parseFENBoard(startingFENBoard)

	// First rank: rnbqkbnr
	assert.Equal(t, byte('r'), grid[0][0])
	assert.Equal(t, byte('n'), grid[0][1])
	assert.Equal(t, byte('b'), grid[0][2])
	assert.Equal(t, byte('q'), grid[0][3])
	assert.Equal(t, byte('k'), grid[0][4])
	assert.Equal(t, byte('b'), grid[0][5])
	assert.Equal(t, byte('n'), grid[0][6])
	assert.Equal(t, byte('r'), grid[0][7])

	// Second rank: all pawns
	for c := 0; c < 8; c++ {
		assert.Equal(t, byte('p'), grid[1][c], "rank 2, col %d", c)
	}

	// Middle ranks: empty
	for r := 2; r < 6; r++ {
		for c := 0; c < 8; c++ {
			assert.Equal(t, byte(0), grid[r][c], "rank %d, col %d should be empty", r, c)
		}
	}

	// Seventh rank: all white pawns
	for c := 0; c < 8; c++ {
		assert.Equal(t, byte('P'), grid[6][c], "rank 7, col %d", c)
	}

	// Eighth rank: RNBQKBNR
	assert.Equal(t, byte('R'), grid[7][0])
	assert.Equal(t, byte('N'), grid[7][1])
	assert.Equal(t, byte('Q'), grid[7][3])
	assert.Equal(t, byte('K'), grid[7][4])
}

func TestParseFENBoard_EmptyBoard(t *testing.T) {
	grid := parseFENBoard("8/8/8/8/8/8/8/8")

	for r := 0; r < 8; r++ {
		for c := 0; c < 8; c++ {
			assert.Equal(t, byte(0), grid[r][c])
		}
	}
}

func TestParseFENBoard_SinglePiece(t *testing.T) {
	// King on e1 (rank 7 in grid, col 4)
	grid := parseFENBoard("8/8/8/8/8/8/8/4K3")
	assert.Equal(t, byte('K'), grid[7][4])

	// Everything else empty
	count := 0
	for r := 0; r < 8; r++ {
		for c := 0; c < 8; c++ {
			if grid[r][c] != 0 {
				count++
			}
		}
	}
	assert.Equal(t, 1, count)
}

func TestParseFENBoard_AfterE4(t *testing.T) {
	grid := parseFENBoard("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR")

	// e4 pawn at rank 4 (index 4), col 4
	assert.Equal(t, byte('P'), grid[4][4])
	// e2 should be empty now
	assert.Equal(t, byte(0), grid[6][4])
}

func TestGridToFEN_StartingPosition(t *testing.T) {
	ranks := [][]string{
		{"b_rook", "b_knight", "b_bishop", "b_queen", "b_king", "b_bishop", "b_knight", "b_rook"},
		{"b_pawn", "b_pawn", "b_pawn", "b_pawn", "b_pawn", "b_pawn", "b_pawn", "b_pawn"},
		{"empty", "empty", "empty", "empty", "empty", "empty", "empty", "empty"},
		{"empty", "empty", "empty", "empty", "empty", "empty", "empty", "empty"},
		{"empty", "empty", "empty", "empty", "empty", "empty", "empty", "empty"},
		{"empty", "empty", "empty", "empty", "empty", "empty", "empty", "empty"},
		{"w_pawn", "w_pawn", "w_pawn", "w_pawn", "w_pawn", "w_pawn", "w_pawn", "w_pawn"},
		{"w_rook", "w_knight", "w_bishop", "w_queen", "w_king", "w_bishop", "w_knight", "w_rook"},
	}

	fen := gridToFEN(ranks)
	assert.Equal(t, startingFENBoard, fen)
}

func TestGridToFEN_EmptyBoard(t *testing.T) {
	ranks := make([][]string, 8)
	for i := range ranks {
		ranks[i] = make([]string, 8)
		for j := range ranks[i] {
			ranks[i][j] = "empty"
		}
	}

	fen := gridToFEN(ranks)
	assert.Equal(t, "8/8/8/8/8/8/8/8", fen)
}

func TestGridToFEN_MixedPosition(t *testing.T) {
	ranks := make([][]string, 8)
	for i := range ranks {
		ranks[i] = make([]string, 8)
		for j := range ranks[i] {
			ranks[i][j] = "empty"
		}
	}
	// Place a white king on e1 and black king on e8
	ranks[0][4] = "b_king"
	ranks[7][4] = "w_king"

	fen := gridToFEN(ranks)
	assert.Equal(t, "4k3/8/8/8/8/8/8/4K3", fen)
}

func TestGridToFEN_RoundTrip(t *testing.T) {
	// Parse a FEN, convert piece names to grid, then back to FEN
	originalFEN := "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR"
	grid := parseFENBoard(originalFEN)

	ranks := make([][]string, 8)
	for r := 0; r < 8; r++ {
		ranks[r] = make([]string, 8)
		for c := 0; c < 8; c++ {
			if grid[r][c] == 0 {
				ranks[r][c] = "empty"
			} else {
				ranks[r][c] = fenPieceMap[grid[r][c]]
			}
		}
	}

	resultFEN := gridToFEN(ranks)
	assert.Equal(t, originalFEN, resultFEN)
}
