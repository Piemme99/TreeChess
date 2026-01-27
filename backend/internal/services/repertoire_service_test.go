package services

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/treechess/backend/internal/models"
)

func TestRepertoireService_CreateRepertoire_InvalidColor(t *testing.T) {
	svc := NewRepertoireService()

	_, err := svc.CreateRepertoire("Test Repertoire", models.Color("invalid"))

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid color")
}

func TestRepertoireService_CreateRepertoire_EmptyName(t *testing.T) {
	svc := NewRepertoireService()

	_, err := svc.CreateRepertoire("", models.ColorWhite)

	assert.Error(t, err)
	assert.ErrorIs(t, err, ErrNameRequired)
}

func TestRepertoireService_CreateRepertoire_NameTooLong(t *testing.T) {
	svc := NewRepertoireService()

	// Create a name with 101 characters
	longName := ""
	for i := 0; i < 101; i++ {
		longName += "a"
	}

	_, err := svc.CreateRepertoire(longName, models.ColorWhite)

	assert.Error(t, err)
	assert.ErrorIs(t, err, ErrNameTooLong)
}

func TestRepertoireService_GetRepertoire_InvalidID(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
}

func TestRepertoireService_RenameRepertoire_EmptyName(t *testing.T) {
	svc := NewRepertoireService()

	_, err := svc.RenameRepertoire("test-id", "")

	assert.Error(t, err)
	assert.ErrorIs(t, err, ErrNameRequired)
}

func TestRepertoireService_RenameRepertoire_NameTooLong(t *testing.T) {
	svc := NewRepertoireService()

	longName := ""
	for i := 0; i < 101; i++ {
		longName += "a"
	}

	_, err := svc.RenameRepertoire("test-id", longName)

	assert.Error(t, err)
	assert.ErrorIs(t, err, ErrNameTooLong)
}

func TestFindNode_Found(t *testing.T) {
	move1 := "e4"
	move2 := "c5"
	move3 := "Nf3"

	root := &models.RepertoireNode{
		ID:         "root",
		MoveNumber: 0,
		Children: []*models.RepertoireNode{
			{
				ID:         "child1",
				Move:       &move1,
				MoveNumber: 1,
				Children: []*models.RepertoireNode{
					{
						ID:         "grandchild",
						Move:       &move3,
						MoveNumber: 3,
					},
				},
			},
			{
				ID:         "child2",
				Move:       &move2,
				MoveNumber: 2,
			},
		},
	}

	found := findNode(root, "grandchild")

	require.NotNil(t, found)
	assert.Equal(t, "grandchild", found.ID)
}

func TestFindNode_NotFound(t *testing.T) {
	root := &models.RepertoireNode{
		ID:         "root",
		MoveNumber: 0,
		Children:   nil,
	}

	found := findNode(root, "nonexistent")

	assert.Nil(t, found)
}

func TestFindNode_Exported(t *testing.T) {
	root := &models.RepertoireNode{
		ID:         "root",
		MoveNumber: 0,
	}

	found := FindNode(root, "root")

	require.NotNil(t, found)
	assert.Equal(t, "root", found.ID)
}

func TestMoveExistsAsChild_NotExists(t *testing.T) {
	parent := models.RepertoireNode{
		ID:       "parent",
		Children: []*models.RepertoireNode{},
	}

	result := moveExistsAsChild(&parent, "Nf3")

	assert.False(t, result)
}

func TestMoveExistsAsChild_Exists(t *testing.T) {
	existingMove := "e4"
	parent := models.RepertoireNode{
		ID: "parent",
		Children: []*models.RepertoireNode{
			{Move: &existingMove},
		},
	}

	result := moveExistsAsChild(&parent, "e4")

	assert.True(t, result)
}

func TestDeleteNodeRecursive_Root(t *testing.T) {
	root := models.RepertoireNode{
		ID: "root",
	}

	result := deleteNodeRecursive(root, "root")

	assert.Nil(t, result, "Should return nil when deleting root")
}

func TestDeleteNodeRecursive_Child(t *testing.T) {
	move1 := "e4"
	move2 := "c5"

	root := models.RepertoireNode{
		ID: "root",
		Children: []*models.RepertoireNode{
			{ID: "child1", Move: &move1},
			{ID: "child2", Move: &move2},
		},
	}

	result := deleteNodeRecursive(root, "child1")

	require.NotNil(t, result)
	assert.Len(t, result.Children, 1)
	assert.Equal(t, "child2", result.Children[0].ID)
}

func TestDeleteNodeRecursive_Grandchild(t *testing.T) {
	move1 := "e4"
	move2 := "c5"
	move3 := "Nf3"

	root := models.RepertoireNode{
		ID: "root",
		Children: []*models.RepertoireNode{
			{
				ID:   "child1",
				Move: &move1,
				Children: []*models.RepertoireNode{
					{ID: "grandchild", Move: &move3, MoveNumber: 3},
				},
			},
			{ID: "child2", Move: &move2},
		},
	}

	result := deleteNodeRecursive(root, "grandchild")

	require.NotNil(t, result)
	assert.Len(t, result.Children[0].Children, 0)
}

func TestCalculateMetadata_SingleNode(t *testing.T) {
	root := models.RepertoireNode{
		ID:         "root",
		Move:       nil,
		MoveNumber: 0,
	}

	metadata := calculateMetadata(root)

	assert.Equal(t, 1, metadata.TotalNodes)
	assert.Equal(t, 0, metadata.TotalMoves)
	assert.Equal(t, 0, metadata.DeepestDepth)
}

func TestCalculateMetadata_WithChildren(t *testing.T) {
	move1 := "e4"
	move2 := "c5"
	move3 := "Nf3"

	root := models.RepertoireNode{
		ID:         "root",
		Move:       nil,
		MoveNumber: 0,
		Children: []*models.RepertoireNode{
			{
				ID:         "child1",
				Move:       &move1,
				MoveNumber: 1,
			},
			{
				ID:         "child2",
				Move:       &move2,
				MoveNumber: 2,
				Children: []*models.RepertoireNode{
					{ID: "grandchild", Move: &move3, MoveNumber: 3},
				},
			},
		},
	}

	metadata := calculateMetadata(root)

	assert.Equal(t, 4, metadata.TotalNodes)
	assert.Equal(t, 3, metadata.TotalMoves)
	assert.Equal(t, 2, metadata.DeepestDepth)
}

func TestValidateAndGetResultingFEN(t *testing.T) {
	startingFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"

	resultFEN, err := validateAndGetResultingFEN(startingFEN, "e4")

	require.NoError(t, err)
	assert.Contains(t, resultFEN, "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq")
}

func TestValidateAndGetResultingFEN_InvalidMove(t *testing.T) {
	startingFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"

	_, err := validateAndGetResultingFEN(startingFEN, "e5")

	assert.Error(t, err)
}

func TestGetColorToMoveFromFEN(t *testing.T) {
	whiteFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
	blackFEN := "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3"

	assert.Equal(t, models.ChessColorWhite, getColorToMoveFromFEN(whiteFEN))
	assert.Equal(t, models.ChessColorBlack, getColorToMoveFromFEN(blackFEN))
}

// Additional tests for edge cases and better coverage

func TestNewRepertoireService(t *testing.T) {
	svc := NewRepertoireService()
	assert.NotNil(t, svc)
}

func TestNewTestRepertoireService(t *testing.T) {
	svc := NewTestRepertoireService()
	assert.NotNil(t, svc)
}

func TestValidateAndGetResultingFEN_InvalidFEN(t *testing.T) {
	invalidFEN := "invalid fen string"

	_, err := validateAndGetResultingFEN(invalidFEN, "e4")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid FEN")
}

func TestValidateAndGetResultingFEN_FullFEN(t *testing.T) {
	// Test with full 6-part FEN
	fullFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

	resultFEN, err := validateAndGetResultingFEN(fullFEN, "e4")

	require.NoError(t, err)
	assert.Contains(t, resultFEN, "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq")
}

func TestValidateAndGetResultingFEN_CastlingMove(t *testing.T) {
	// Position where white can castle kingside
	fen := "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq -"

	resultFEN, err := validateAndGetResultingFEN(fen, "O-O")

	require.NoError(t, err)
	// After castling, the FEN should show the king on g1 and rook on f1
	assert.Contains(t, resultFEN, "R4RK1")
}

func TestValidateAndGetResultingFEN_QueensideCastling(t *testing.T) {
	fen := "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq -"

	resultFEN, err := validateAndGetResultingFEN(fen, "O-O-O")

	require.NoError(t, err)
	// After queenside castling
	assert.Contains(t, resultFEN, "2KR3R")
}

func TestValidateAndGetResultingFEN_PawnPromotion(t *testing.T) {
	// Position with pawn on e7, king on e1, black king on h8 - pawn can promote
	fen := "7k/4P3/8/8/8/8/8/4K3 w - -"

	resultFEN, err := validateAndGetResultingFEN(fen, "e8=Q")

	require.NoError(t, err)
	assert.Contains(t, resultFEN, "4Q2k") // Queen on e8
}

func TestValidateAndGetResultingFEN_EnPassant(t *testing.T) {
	// Position where en passant is possible
	fen := "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6"

	resultFEN, err := validateAndGetResultingFEN(fen, "exd6")

	require.NoError(t, err)
	assert.NotEmpty(t, resultFEN)
}

func TestGetColorToMoveFromFEN_ShortFEN(t *testing.T) {
	// Test with FEN that only has one part
	shortFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"

	// Should default to white when color indicator is missing
	result := getColorToMoveFromFEN(shortFEN)
	assert.Equal(t, models.ChessColorWhite, result)
}

func TestFindNode_RootMatch(t *testing.T) {
	root := &models.RepertoireNode{
		ID:         "root-id",
		MoveNumber: 0,
	}

	found := findNode(root, "root-id")

	require.NotNil(t, found)
	assert.Equal(t, "root-id", found.ID)
}

func TestFindNode_DeepTree(t *testing.T) {
	move := "e4"
	// Create a deep tree structure
	root := &models.RepertoireNode{
		ID: "root",
		Children: []*models.RepertoireNode{
			{
				ID:   "level1",
				Move: &move,
				Children: []*models.RepertoireNode{
					{
						ID:   "level2",
						Move: &move,
						Children: []*models.RepertoireNode{
							{
								ID:   "level3",
								Move: &move,
								Children: []*models.RepertoireNode{
									{
										ID:   "level4-target",
										Move: &move,
									},
								},
							},
						},
					},
				},
			},
		},
	}

	found := findNode(root, "level4-target")

	require.NotNil(t, found)
	assert.Equal(t, "level4-target", found.ID)
}

func TestMoveExistsAsChild_NilMove(t *testing.T) {
	// Child with nil move should not match
	parent := models.RepertoireNode{
		ID: "parent",
		Children: []*models.RepertoireNode{
			{ID: "child", Move: nil},
		},
	}

	result := moveExistsAsChild(&parent, "e4")

	assert.False(t, result)
}

func TestMoveExistsAsChild_MultipleChildren(t *testing.T) {
	move1 := "e4"
	move2 := "d4"
	move3 := "Nf3"

	parent := models.RepertoireNode{
		ID: "parent",
		Children: []*models.RepertoireNode{
			{ID: "child1", Move: &move1},
			{ID: "child2", Move: &move2},
			{ID: "child3", Move: &move3},
		},
	}

	assert.True(t, moveExistsAsChild(&parent, "d4"))
	assert.True(t, moveExistsAsChild(&parent, "Nf3"))
	assert.False(t, moveExistsAsChild(&parent, "c4"))
}

func TestDeleteNodeRecursive_NotFound(t *testing.T) {
	move := "e4"
	root := models.RepertoireNode{
		ID: "root",
		Children: []*models.RepertoireNode{
			{ID: "child1", Move: &move},
		},
	}

	result := deleteNodeRecursive(root, "nonexistent")

	assert.Nil(t, result, "Should return nil when node not found")
}

func TestDeleteNodeRecursive_LastChild(t *testing.T) {
	move := "e4"
	root := models.RepertoireNode{
		ID: "root",
		Children: []*models.RepertoireNode{
			{ID: "only-child", Move: &move},
		},
	}

	result := deleteNodeRecursive(root, "only-child")

	require.NotNil(t, result)
	assert.Len(t, result.Children, 0)
}

func TestDeleteNodeRecursive_MiddleChild(t *testing.T) {
	move1 := "e4"
	move2 := "d4"
	move3 := "c4"

	root := models.RepertoireNode{
		ID: "root",
		Children: []*models.RepertoireNode{
			{ID: "child1", Move: &move1},
			{ID: "child2", Move: &move2},
			{ID: "child3", Move: &move3},
		},
	}

	result := deleteNodeRecursive(root, "child2")

	require.NotNil(t, result)
	assert.Len(t, result.Children, 2)
	assert.Equal(t, "child1", result.Children[0].ID)
	assert.Equal(t, "child3", result.Children[1].ID)
}

func TestCalculateMetadata_DeepTree(t *testing.T) {
	move := "e4"

	// Create a tree with depth 5
	root := models.RepertoireNode{
		ID:   "root",
		Move: nil,
		Children: []*models.RepertoireNode{
			{
				ID:   "d1",
				Move: &move,
				Children: []*models.RepertoireNode{
					{
						ID:   "d2",
						Move: &move,
						Children: []*models.RepertoireNode{
							{
								ID:   "d3",
								Move: &move,
								Children: []*models.RepertoireNode{
									{
										ID:   "d4",
										Move: &move,
										Children: []*models.RepertoireNode{
											{ID: "d5", Move: &move},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}

	metadata := calculateMetadata(root)

	assert.Equal(t, 6, metadata.TotalNodes)
	assert.Equal(t, 5, metadata.TotalMoves)
	assert.Equal(t, 5, metadata.DeepestDepth)
}

func TestCalculateMetadata_WideTree(t *testing.T) {
	move := "e4"

	// Create a wide tree with many children at same level
	root := models.RepertoireNode{
		ID:   "root",
		Move: nil,
		Children: []*models.RepertoireNode{
			{ID: "c1", Move: &move},
			{ID: "c2", Move: &move},
			{ID: "c3", Move: &move},
			{ID: "c4", Move: &move},
			{ID: "c5", Move: &move},
		},
	}

	metadata := calculateMetadata(root)

	assert.Equal(t, 6, metadata.TotalNodes)
	assert.Equal(t, 5, metadata.TotalMoves)
	assert.Equal(t, 1, metadata.DeepestDepth)
}

func TestValidateAndGetResultingFEN_KnightMove(t *testing.T) {
	startingFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"

	resultFEN, err := validateAndGetResultingFEN(startingFEN, "Nf3")

	require.NoError(t, err)
	assert.Contains(t, resultFEN, "PPPPPPPP/RNBQKB1R") // Knight moved from g1
}

func TestValidateAndGetResultingFEN_BishopMove(t *testing.T) {
	// Position after e4 e5
	fen := "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -"

	resultFEN, err := validateAndGetResultingFEN(fen, "Bc4")

	require.NoError(t, err)
	assert.NotEmpty(t, resultFEN)
}

// Test error sentinel values
func TestSentinelErrors(t *testing.T) {
	assert.NotNil(t, ErrInvalidColor)
	assert.NotNil(t, ErrRepertoireExists)
	assert.NotNil(t, ErrNotFound)
	assert.NotNil(t, ErrParentNotFound)
	assert.NotNil(t, ErrInvalidMove)
	assert.NotNil(t, ErrMoveExists)
	assert.NotNil(t, ErrCannotDeleteRoot)
	assert.NotNil(t, ErrNodeNotFound)
	assert.NotNil(t, ErrLimitReached)
	assert.NotNil(t, ErrNameRequired)
	assert.NotNil(t, ErrNameTooLong)

	// Verify error messages
	assert.Contains(t, ErrInvalidColor.Error(), "invalid color")
	assert.Contains(t, ErrCannotDeleteRoot.Error(), "cannot delete root")
	assert.Contains(t, ErrLimitReached.Error(), "50")
	assert.Contains(t, ErrNameRequired.Error(), "required")
}

func TestListRepertoires_InvalidColor(t *testing.T) {
	svc := NewRepertoireService()
	invalidColor := models.Color("invalid")

	_, err := svc.ListRepertoires(&invalidColor)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid color")
}

func TestRepertoireService_RenameRepertoire_NotFound(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
}
