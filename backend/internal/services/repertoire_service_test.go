package services

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/repository/mocks"
)

func TestRepertoireService_CreateRepertoire_InvalidColor(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.CreateRepertoire(context.Background(), "user-1", "Test Repertoire", models.Color("invalid"))

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid color")
}

func TestRepertoireService_CreateRepertoire_EmptyName(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.CreateRepertoire(context.Background(), "user-1", "", models.ColorWhite)

	assert.Error(t, err)
	assert.ErrorIs(t, err, ErrNameRequired)
}

func TestRepertoireService_CreateRepertoire_NameTooLong(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{}
	svc := NewRepertoireService(mockRepo)

	// Create a name with 101 characters
	longName := ""
	for i := 0; i < 101; i++ {
		longName += "a"
	}

	_, err := svc.CreateRepertoire(context.Background(), "user-1", longName, models.ColorWhite)

	assert.Error(t, err)
	assert.ErrorIs(t, err, ErrNameTooLong)
}

func TestRepertoireService_GetRepertoire_InvalidID_Skip(t *testing.T) {
	t.Skip("Covered by mock-based test below")
}

func TestRepertoireService_RenameRepertoire_EmptyName(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.RenameRepertoire(context.Background(), "user-1", "test-id", "")

	assert.Error(t, err)
	assert.ErrorIs(t, err, ErrNameRequired)
}

func TestRepertoireService_RenameRepertoire_NameTooLong(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{}
	svc := NewRepertoireService(mockRepo)

	longName := ""
	for i := 0; i < 101; i++ {
		longName += "a"
	}

	_, err := svc.RenameRepertoire(context.Background(), "user-1", "test-id", longName)

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
	mockRepo := &mocks.MockRepertoireRepo{}
	svc := NewRepertoireService(mockRepo)
	assert.NotNil(t, svc)
}

func TestNewRepertoireService_WithNilRepo(t *testing.T) {
	svc := NewRepertoireService(nil)
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
	mockRepo := &mocks.MockRepertoireRepo{}
	svc := NewRepertoireService(mockRepo)
	invalidColor := models.Color("invalid")

	_, err := svc.ListRepertoires(context.Background(), "user-1", &invalidColor)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid color")
}

func TestRepertoireService_RenameRepertoire_NotFound_Skip(t *testing.T) {
	t.Skip("Covered by mock-based test below")
}

// --- MergeRepertoires tests ---

func makeTree(rootID string, children ...*models.RepertoireNode) models.RepertoireNode {
	return models.RepertoireNode{
		ID:          rootID,
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		MoveNumber:  0,
		ColorToMove: "w",
		Children:    children,
	}
}

func makeChild(id, move string, children ...*models.RepertoireNode) *models.RepertoireNode {
	return &models.RepertoireNode{
		ID:          id,
		FEN:         "some-fen",
		Move:        &move,
		MoveNumber:  1,
		ColorToMove: "b",
		Children:    children,
	}
}

func TestMergeRepertoires_Success(t *testing.T) {
	e4 := "e4"
	d4 := "d4"

	rep1 := &models.Repertoire{
		ID:       "rep-1",
		Name:     "Rep 1",
		Color:    models.ColorWhite,
		TreeData: makeTree("root-1", &models.RepertoireNode{ID: "c1", Move: &e4, MoveNumber: 1, ColorToMove: "b", Children: []*models.RepertoireNode{}}),
	}
	rep2 := &models.Repertoire{
		ID:       "rep-2",
		Name:     "Rep 2",
		Color:    models.ColorWhite,
		TreeData: makeTree("root-2", &models.RepertoireNode{ID: "c2", Move: &d4, MoveNumber: 1, ColorToMove: "b", Children: []*models.RepertoireNode{}}),
	}

	var createdID string
	var savedTree models.RepertoireNode
	deletedIDs := map[string]bool{}

	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			switch id {
			case "rep-1":
				return rep1, nil
			case "rep-2":
				return rep2, nil
			default:
				return nil, repository.ErrRepertoireNotFound
			}
		},
		CreateFunc: func(_ context.Context, userID string, name string, color models.Color) (*models.Repertoire, error) {
			createdID = "new-merged"
			return &models.Repertoire{
				ID:       createdID,
				Name:     name,
				Color:    color,
				TreeData: makeTree("new-root"),
			}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			savedTree = treeData
			return &models.Repertoire{
				ID:       id,
				Name:     "Merged",
				Color:    models.ColorWhite,
				TreeData: treeData,
				Metadata: metadata,
			}, nil
		},
		DeleteFunc: func(_ context.Context, id string, userID string) error {
			deletedIDs[id] = true
			return nil
		},
	}

	svc := NewRepertoireService(mockRepo)
	result, err := svc.MergeRepertoires(context.Background(), "user-1", []string{"rep-1", "rep-2"}, "Merged")

	require.NoError(t, err)
	require.NotNil(t, result)
	require.NotNil(t, result.Merged)

	// New repertoire should have children from both sources
	assert.Len(t, savedTree.Children, 2)

	// Both originals should be deleted
	assert.True(t, deletedIDs["rep-1"])
	assert.True(t, deletedIDs["rep-2"])
}

func TestMergeRepertoires_ThreeWay(t *testing.T) {
	e4 := "e4"
	d4 := "d4"
	c4 := "c4"

	reps := map[string]*models.Repertoire{
		"rep-1": {ID: "rep-1", Color: models.ColorWhite, TreeData: makeTree("r1", makeChild("c1", e4))},
		"rep-2": {ID: "rep-2", Color: models.ColorWhite, TreeData: makeTree("r2", makeChild("c2", d4))},
		"rep-3": {ID: "rep-3", Color: models.ColorWhite, TreeData: makeTree("r3", makeChild("c3", c4))},
	}

	deletedIDs := map[string]bool{}
	var savedTree models.RepertoireNode

	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			if r, ok := reps[id]; ok {
				return r, nil
			}
			return nil, repository.ErrRepertoireNotFound
		},
		CreateFunc: func(_ context.Context, userID, name string, color models.Color) (*models.Repertoire, error) {
			return &models.Repertoire{ID: "new", Name: name, Color: color, TreeData: makeTree("new-root")}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			savedTree = treeData
			return &models.Repertoire{ID: id, TreeData: treeData, Metadata: metadata}, nil
		},
		DeleteFunc: func(_ context.Context, id string, userID string) error {
			deletedIDs[id] = true
			return nil
		},
	}

	svc := NewRepertoireService(mockRepo)
	result, err := svc.MergeRepertoires(context.Background(), "user-1", []string{"rep-1", "rep-2", "rep-3"}, "Three Way")

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Len(t, savedTree.Children, 3)
	assert.True(t, deletedIDs["rep-1"])
	assert.True(t, deletedIDs["rep-2"])
	assert.True(t, deletedIDs["rep-3"])
}

func TestMergeRepertoires_FewerThanTwo(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.MergeRepertoires(context.Background(), "user-1", []string{"rep-1"}, "Name")
	assert.ErrorIs(t, err, ErrMergeMinimumTwo)

	_, err = svc.MergeRepertoires(context.Background(), "user-1", []string{}, "Name")
	assert.ErrorIs(t, err, ErrMergeMinimumTwo)
}

func TestMergeRepertoires_ColorMismatch(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			if id == "rep-w" {
				return &models.Repertoire{ID: "rep-w", Color: models.ColorWhite, TreeData: makeTree("rw")}, nil
			}
			return &models.Repertoire{ID: "rep-b", Color: models.ColorBlack, TreeData: makeTree("rb")}, nil
		},
	}

	svc := NewRepertoireService(mockRepo)
	_, err := svc.MergeRepertoires(context.Background(), "user-1", []string{"rep-w", "rep-b"}, "Mixed")

	assert.ErrorIs(t, err, ErrMergeColorMismatch)
}

func TestMergeRepertoires_EmptyName(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.MergeRepertoires(context.Background(), "user-1", []string{"a", "b"}, "")
	assert.ErrorIs(t, err, ErrNameRequired)

	_, err = svc.MergeRepertoires(context.Background(), "user-1", []string{"a", "b"}, "   ")
	assert.ErrorIs(t, err, ErrNameRequired)
}

func TestMergeRepertoires_NotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			if id == "exists" {
				return &models.Repertoire{ID: "exists", Color: models.ColorWhite, TreeData: makeTree("r")}, nil
			}
			return nil, repository.ErrRepertoireNotFound
		},
	}

	svc := NewRepertoireService(mockRepo)
	_, err := svc.MergeRepertoires(context.Background(), "user-1", []string{"exists", "missing"}, "Name")

	assert.Error(t, err)
	assert.ErrorIs(t, err, ErrNotFound)
}

func TestMergeRepertoires_DuplicateIDs(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.MergeRepertoires(context.Background(), "user-1", []string{"rep-1", "rep-1"}, "Dup")
	assert.ErrorIs(t, err, ErrMergeDuplicateIDs)
}

// --- GetRepertoire tests ---

func TestRepertoireService_GetRepertoire_Success(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:   id,
				Name: "Test",
			}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	rep, err := svc.GetRepertoire(context.Background(), "rep-1")

	require.NoError(t, err)
	assert.Equal(t, "rep-1", rep.ID)
}

func TestRepertoireService_GetRepertoire_NotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return nil, repository.ErrRepertoireNotFound
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.GetRepertoire(context.Background(), "nonexistent")

	assert.Error(t, err)
	assert.ErrorIs(t, err, ErrNotFound)
}

func TestRepertoireService_GetRepertoire_RepoError(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return nil, assert.AnError
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.GetRepertoire(context.Background(), "rep-1")

	assert.Error(t, err)
	assert.ErrorIs(t, err, assert.AnError)
}

// --- AddNode tests ---

func TestRepertoireService_AddNode_Success(t *testing.T) {
	rootID := "root-uuid"
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:    id,
				Name:  "Test",
				Color: models.ColorWhite,
				TreeData: models.RepertoireNode{
					ID:       rootID,
					FEN:      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
					Children: []*models.RepertoireNode{},
				},
			}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:       id,
				TreeData: treeData,
				Metadata: metadata,
			}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	rep, err := svc.AddNode(context.Background(), "user-1", "rep-1", models.AddNodeRequest{
		ParentID:   rootID,
		Move:       "e4",
		MoveNumber: 1,
	})

	require.NoError(t, err)
	require.Len(t, rep.TreeData.Children, 1)
	assert.Equal(t, "e4", *rep.TreeData.Children[0].Move)
}

// TestRepertoireService_AddNode_DerivesMoveNumber verifies that AddNode computes
// MoveNumber server-side from the parent (full-move counter), ignoring a bogus
// client-supplied value, so transposition keys stay consistent.
func TestRepertoireService_AddNode_DerivesMoveNumber(t *testing.T) {
	moveE4 := "e4"
	moveE5 := "e5"
	// root (move 0, white to move) -> e4 (move 1, black to move) -> e5 (move 1, white to move)
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:    id,
				Color: models.ColorWhite,
				TreeData: models.RepertoireNode{
					ID:          "root",
					FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
					MoveNumber:  0,
					ColorToMove: models.ChessColorWhite,
					Children: []*models.RepertoireNode{
						{
							ID:          "e4",
							FEN:         "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
							Move:        &moveE4,
							MoveNumber:  1,
							ColorToMove: models.ChessColorBlack,
							Children: []*models.RepertoireNode{
								{
									ID:          "e5",
									FEN:         "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6",
									Move:        &moveE5,
									MoveNumber:  1,
									ColorToMove: models.ChessColorWhite,
									Children:    []*models.RepertoireNode{},
								},
							},
						},
					},
				},
			}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, TreeData: treeData, Metadata: metadata}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	// White move from root: derived MoveNumber must be 1, regardless of the
	// (deliberately wrong) client value 99.
	rep, err := svc.AddNode(context.Background(), "user-1", "rep-1", models.AddNodeRequest{
		ParentID:   "root",
		Move:       "d4",
		MoveNumber: 99,
	})
	require.NoError(t, err)
	d4 := findNodeByMove(&rep.TreeData, "d4")
	require.NotNil(t, d4)
	assert.Equal(t, 1, d4.MoveNumber, "white move from root should be full-move 1")

	// Black move from e4 (parent MoveNumber 1, black to move): completes move 1.
	rep, err = svc.AddNode(context.Background(), "user-1", "rep-1", models.AddNodeRequest{
		ParentID:   "e4",
		Move:       "c5",
		MoveNumber: 0,
	})
	require.NoError(t, err)
	c5 := findNodeByMove(&rep.TreeData, "c5")
	require.NotNil(t, c5)
	assert.Equal(t, 1, c5.MoveNumber, "black move completing first full move should be move 1")

	// White move from e5 (parent MoveNumber 1, white to move): starts move 2.
	rep, err = svc.AddNode(context.Background(), "user-1", "rep-1", models.AddNodeRequest{
		ParentID:   "e5",
		Move:       "Nf3",
		MoveNumber: 0,
	})
	require.NoError(t, err)
	nf3 := findNodeByMove(&rep.TreeData, "Nf3")
	require.NotNil(t, nf3)
	assert.Equal(t, 2, nf3.MoveNumber, "second white move should be full-move 2")
}

func TestRepertoireService_AddNode_RepertoireNotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return nil, repository.ErrRepertoireNotFound
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.AddNode(context.Background(), "user-1", "rep-1", models.AddNodeRequest{
		ParentID: "root", Move: "e4", MoveNumber: 1,
	})

	assert.ErrorIs(t, err, ErrNotFound)
}

func TestRepertoireService_AddNode_ParentNotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: id,
				TreeData: models.RepertoireNode{
					ID:       "root",
					FEN:      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
					Children: []*models.RepertoireNode{},
				},
			}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.AddNode(context.Background(), "user-1", "rep-1", models.AddNodeRequest{
		ParentID: "nonexistent", Move: "e4", MoveNumber: 1,
	})

	assert.ErrorIs(t, err, ErrParentNotFound)
}

func TestRepertoireService_AddNode_MoveExists(t *testing.T) {
	move := "e4"
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: id,
				TreeData: models.RepertoireNode{
					ID:  "root",
					FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
					Children: []*models.RepertoireNode{
						{ID: "child", Move: &move, FEN: "after-e4"},
					},
				},
			}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.AddNode(context.Background(), "user-1", "rep-1", models.AddNodeRequest{
		ParentID: "root", Move: "e4", MoveNumber: 1,
	})

	assert.ErrorIs(t, err, ErrMoveExists)
}

func TestRepertoireService_AddNode_IllegalMove(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: id,
				TreeData: models.RepertoireNode{
					ID:       "root",
					FEN:      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
					Children: []*models.RepertoireNode{},
				},
			}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.AddNode(context.Background(), "user-1", "rep-1", models.AddNodeRequest{
		ParentID: "root", Move: "e5", MoveNumber: 1,
	})

	assert.ErrorIs(t, err, ErrInvalidMove)
}

// --- SaveTree tests ---

func TestRepertoireService_SaveTree_Success(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:       id,
				TreeData: treeData,
				Metadata: metadata,
			}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	tree := models.RepertoireNode{
		ID:  "root",
		FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
	}
	rep, err := svc.SaveTree(context.Background(), "user-1", "rep-1", tree)

	require.NoError(t, err)
	assert.Equal(t, "rep-1", rep.ID)
}

func TestRepertoireService_SaveTree_NotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return nil, repository.ErrRepertoireNotFound
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.SaveTree(context.Background(), "user-1", "nonexistent", models.RepertoireNode{})

	assert.ErrorIs(t, err, ErrNotFound)
}

// --- DeleteNode tests ---

func TestRepertoireService_DeleteNode_Success(t *testing.T) {
	move := "e4"
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: id,
				TreeData: models.RepertoireNode{
					ID:  "root",
					FEN: "start",
					Children: []*models.RepertoireNode{
						{ID: "child", Move: &move},
					},
				},
			}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, TreeData: treeData, Metadata: metadata}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	rep, err := svc.DeleteNode(context.Background(), "user-1", "rep-1", "child")

	require.NoError(t, err)
	assert.Len(t, rep.TreeData.Children, 0)
}

func TestRepertoireService_DeleteNode_CannotDeleteRoot(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:       id,
				TreeData: models.RepertoireNode{ID: "root"},
			}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.DeleteNode(context.Background(), "user-1", "rep-1", "root")

	assert.ErrorIs(t, err, ErrCannotDeleteRoot)
}

func TestRepertoireService_DeleteNode_NodeNotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:       id,
				TreeData: models.RepertoireNode{ID: "root", Children: []*models.RepertoireNode{}},
			}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.DeleteNode(context.Background(), "user-1", "rep-1", "nonexistent")

	assert.ErrorIs(t, err, ErrNodeNotFound)
}

func TestRepertoireService_DeleteNode_RepertoireNotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return nil, repository.ErrRepertoireNotFound
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.DeleteNode(context.Background(), "user-1", "nonexistent", "node")

	assert.ErrorIs(t, err, ErrNotFound)
}

// --- ExtractSubtree tests ---

func TestRepertoireService_ExtractSubtree_Success(t *testing.T) {
	move1 := "e4"
	move2 := "e5"
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:    id,
				Name:  "Original",
				Color: models.ColorWhite,
				TreeData: models.RepertoireNode{
					ID:  "root",
					FEN: "start",
					Children: []*models.RepertoireNode{
						{
							ID:   "child1",
							Move: &move1,
							FEN:  "after-e4",
							Children: []*models.RepertoireNode{
								{ID: "grandchild", Move: &move2, FEN: "after-e5", Children: []*models.RepertoireNode{}},
							},
						},
					},
				},
			}, nil
		},
		CountFunc: func(_ context.Context, userID string) (int, error) { return 1, nil },
		CreateFunc: func(_ context.Context, userID, name string, color models.Color) (*models.Repertoire, error) {
			return &models.Repertoire{ID: "new-rep", Name: name, Color: color}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, TreeData: treeData, Metadata: metadata}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	result, err := svc.ExtractSubtree(context.Background(), "user-1", "rep-1", "child1", "Extracted")

	require.NoError(t, err)
	require.NotNil(t, result)
	require.NotNil(t, result.Original)
	require.NotNil(t, result.Extracted)
}

func TestRepertoireService_ExtractSubtree_RootBlocked(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:       id,
				TreeData: models.RepertoireNode{ID: "root"},
			}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.ExtractSubtree(context.Background(), "user-1", "rep-1", "root", "Name")

	assert.ErrorIs(t, err, ErrCannotExtractRoot)
}

func TestRepertoireService_ExtractSubtree_NodeNotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:       id,
				TreeData: models.RepertoireNode{ID: "root", Children: []*models.RepertoireNode{}},
			}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.ExtractSubtree(context.Background(), "user-1", "rep-1", "nonexistent", "Name")

	assert.ErrorIs(t, err, ErrNodeNotFound)
}

func TestRepertoireService_ExtractSubtree_LimitReached(t *testing.T) {
	move := "e4"
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: id,
				TreeData: models.RepertoireNode{
					ID:       "root",
					Children: []*models.RepertoireNode{{ID: "child", Move: &move}},
				},
			}, nil
		},
		CountFunc: func(_ context.Context, userID string) (int, error) { return 50, nil },
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.ExtractSubtree(context.Background(), "user-1", "rep-1", "child", "Name")

	assert.ErrorIs(t, err, ErrLimitReached)
}

func TestRepertoireService_ExtractSubtree_NameTooLong(t *testing.T) {
	move := "e4"
	longName := ""
	for i := 0; i < 101; i++ {
		longName += "a"
	}
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: id,
				TreeData: models.RepertoireNode{
					ID:       "root",
					Children: []*models.RepertoireNode{{ID: "child", Move: &move}},
				},
			}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.ExtractSubtree(context.Background(), "user-1", "rep-1", "child", longName)

	assert.ErrorIs(t, err, ErrNameTooLong)
}

// --- UpdateNodeComment tests ---

func TestRepertoireService_UpdateNodeComment_Set(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: id,
				TreeData: models.RepertoireNode{
					ID:  "root",
					FEN: "start",
					Children: []*models.RepertoireNode{
						{ID: "node-1", FEN: "fen1", Children: []*models.RepertoireNode{}},
					},
				},
			}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, TreeData: treeData}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	rep, err := svc.UpdateNodeComment(context.Background(), "user-1", "rep-1", "node-1", "This is a comment")

	require.NoError(t, err)
	node := findNode(&rep.TreeData, "node-1")
	require.NotNil(t, node)
	require.NotNil(t, node.Comment)
	assert.Equal(t, "This is a comment", *node.Comment)
}

func TestRepertoireService_UpdateNodeComment_Clear(t *testing.T) {
	comment := "old comment"
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: id,
				TreeData: models.RepertoireNode{
					ID:  "root",
					FEN: "start",
					Children: []*models.RepertoireNode{
						{ID: "node-1", FEN: "fen1", Comment: &comment, Children: []*models.RepertoireNode{}},
					},
				},
			}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, TreeData: treeData}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	rep, err := svc.UpdateNodeComment(context.Background(), "user-1", "rep-1", "node-1", "")

	require.NoError(t, err)
	node := findNode(&rep.TreeData, "node-1")
	require.NotNil(t, node)
	assert.Nil(t, node.Comment)
}

func TestRepertoireService_UpdateNodeComment_NodeNotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:       id,
				TreeData: models.RepertoireNode{ID: "root", Children: []*models.RepertoireNode{}},
			}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.UpdateNodeComment(context.Background(), "user-1", "rep-1", "nonexistent", "comment")

	assert.ErrorIs(t, err, ErrNodeNotFound)
}

func TestRepertoireService_UpdateNodeComment_RepertoireNotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return nil, repository.ErrRepertoireNotFound
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.UpdateNodeComment(context.Background(), "user-1", "nonexistent", "node", "comment")

	assert.ErrorIs(t, err, ErrNotFound)
}

// --- DeleteRepertoire tests ---

func TestRepertoireService_DeleteRepertoire_Success(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		DeleteFunc: func(_ context.Context, id string, userID string) error { return nil },
	}
	svc := NewRepertoireService(mockRepo)

	err := svc.DeleteRepertoire(context.Background(), "user-1", "rep-1")

	assert.NoError(t, err)
}

func TestRepertoireService_DeleteRepertoire_NotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		DeleteFunc: func(_ context.Context, id string, userID string) error { return repository.ErrRepertoireNotFound },
	}
	svc := NewRepertoireService(mockRepo)

	err := svc.DeleteRepertoire(context.Background(), "user-1", "nonexistent")

	assert.ErrorIs(t, err, ErrNotFound)
}

// --- CheckOwnership tests ---

func TestRepertoireService_CheckOwnership_Belongs(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		BelongsToUserFunc: func(_ context.Context, id, userID string) (bool, error) { return true, nil },
	}
	svc := NewRepertoireService(mockRepo)

	err := svc.CheckOwnership(context.Background(), "rep-1", "user-1")

	assert.NoError(t, err)
}

func TestRepertoireService_CheckOwnership_NotBelongs(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		BelongsToUserFunc: func(_ context.Context, id, userID string) (bool, error) { return false, nil },
	}
	svc := NewRepertoireService(mockRepo)

	err := svc.CheckOwnership(context.Background(), "rep-1", "other-user")

	assert.ErrorIs(t, err, ErrNotFound)
}

func TestRepertoireService_CheckOwnership_RepoError(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		BelongsToUserFunc: func(_ context.Context, id, userID string) (bool, error) {
			return false, assert.AnError
		},
	}
	svc := NewRepertoireService(mockRepo)

	err := svc.CheckOwnership(context.Background(), "rep-1", "user-1")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to check ownership")
}

// --- CreateRepertoire success + limit ---

func TestRepertoireService_CreateRepertoire_Success(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		CountFunc: func(_ context.Context, userID string) (int, error) { return 0, nil },
		CreateFunc: func(_ context.Context, userID, name string, color models.Color) (*models.Repertoire, error) {
			return &models.Repertoire{ID: "new-rep", Name: name, Color: color}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	rep, err := svc.CreateRepertoire(context.Background(), "user-1", "My Repertoire", models.ColorWhite)

	require.NoError(t, err)
	assert.Equal(t, "My Repertoire", rep.Name)
	assert.Equal(t, models.ColorWhite, rep.Color)
}

func TestRepertoireService_CreateRepertoire_LimitReached(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		CountFunc: func(_ context.Context, userID string) (int, error) { return 50, nil },
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.CreateRepertoire(context.Background(), "user-1", "Another", models.ColorWhite)

	assert.ErrorIs(t, err, ErrLimitReached)
}

// --- ListRepertoires tests ---

func TestRepertoireService_ListRepertoires_WithColor(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByColorFunc: func(_ context.Context, userID string, color models.Color) ([]models.Repertoire, error) {
			return []models.Repertoire{{ID: "rep-1", Color: color}}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)
	white := models.ColorWhite

	reps, err := svc.ListRepertoires(context.Background(), "user-1", &white)

	require.NoError(t, err)
	assert.Len(t, reps, 1)
}

func TestRepertoireService_ListRepertoires_All(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetAllFunc: func(_ context.Context, userID string) ([]models.Repertoire, error) {
			return []models.Repertoire{{ID: "rep-1"}, {ID: "rep-2"}}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	reps, err := svc.ListRepertoires(context.Background(), "user-1", nil)

	require.NoError(t, err)
	assert.Len(t, reps, 2)
}

// --- RenameRepertoire with mock ---

func TestRepertoireService_RenameRepertoire_Success(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		ExistsFunc: func(_ context.Context, id string) (bool, error) { return true, nil },
		UpdateNameFunc: func(_ context.Context, id, userID, name string) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, Name: name}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	rep, err := svc.RenameRepertoire(context.Background(), "user-1", "rep-1", "New Name")

	require.NoError(t, err)
	assert.Equal(t, "New Name", rep.Name)
}

func TestRepertoireService_RenameRepertoire_NotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		ExistsFunc: func(_ context.Context, id string) (bool, error) { return false, nil },
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.RenameRepertoire(context.Background(), "user-1", "nonexistent", "Name")

	assert.ErrorIs(t, err, ErrNotFound)
}

// --- MergeTranspositions tests ---

// helper to build a node
func mkNode(id string, fen string, move *string, moveNumber int, colorToMove models.ChessColor, parentID *string, children ...*models.RepertoireNode) *models.RepertoireNode {
	if children == nil {
		children = []*models.RepertoireNode{}
	}
	return &models.RepertoireNode{
		ID:          id,
		FEN:         fen,
		Move:        move,
		MoveNumber:  moveNumber,
		ColorToMove: colorToMove,
		ParentID:    parentID,
		Children:    children,
	}
}

func TestMergeTranspositions_BasicMerge(t *testing.T) {
	// Two branches reaching the same position at move 2:
	// Root -> e4 -> e5 -> Nf3 (pos X) -> Nc6
	// Root -> Nf3 -> e5 -> e4 (pos X) -> Bc5
	// After merge: Nf3 (canonical) has children [Nc6, Bc5], e4 becomes transposition.
	posX := "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -"
	rootID := "root"

	nc6 := mkNode("nc6", "some-fen-nc6", strPtr("Nc6"), 2, "w", strPtr("nf3-1"))
	d6 := mkNode("d6", "some-fen-d6", strPtr("d6"), 2, "w", strPtr("nf3-1"))
	nf3Node1 := mkNode("nf3-1", posX, strPtr("Nf3"), 2, "b", strPtr("e5-1"), nc6, d6)
	e5Node1 := mkNode("e5-1", "fen-e5-1", strPtr("e5"), 1, "w", strPtr("e4-1"), nf3Node1)
	e4Node1 := mkNode("e4-1", "fen-e4", strPtr("e4"), 1, "b", &rootID, e5Node1)

	bc5 := mkNode("bc5", "some-fen-bc5", strPtr("Bc5"), 2, "w", strPtr("e4-2"))
	e4Node2 := mkNode("e4-2", posX, strPtr("e4"), 2, "b", strPtr("e5-2"), bc5)
	e5Node2 := mkNode("e5-2", "fen-e5-2", strPtr("e5"), 1, "w", strPtr("nf3-2"), e4Node2)
	nf3Node2 := mkNode("nf3-2", "fen-nf3", strPtr("Nf3"), 1, "b", &rootID, e5Node2)

	root := models.RepertoireNode{
		ID:          rootID,
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
		MoveNumber:  0,
		ColorToMove: "w",
		Children:    []*models.RepertoireNode{e4Node1, nf3Node2},
	}

	var savedTree models.RepertoireNode
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:       "rep-1",
				TreeData: root,
			}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			savedTree = treeData
			return &models.Repertoire{
				ID:       id,
				TreeData: treeData,
				Metadata: metadata,
			}, nil
		},
	}

	svc := NewRepertoireService(mockRepo)
	result, err := svc.MergeTranspositions(context.Background(), "user-1", "rep-1")
	require.NoError(t, err)

	// nf3-1 is the canonical node (encountered first in BFS)
	canonicalNode := findNode(&savedTree, "nf3-1")
	require.NotNil(t, canonicalNode)
	assert.Nil(t, canonicalNode.TranspositionOf)
	// Canonical should have 3 children: Nc6, d6 (original), Bc5 (merged from e4-2)
	assert.Equal(t, 3, len(canonicalNode.Children))

	// e4-2 should be a transposition pointer
	transpNode := findNode(&savedTree, "e4-2")
	require.NotNil(t, transpNode)
	require.NotNil(t, transpNode.TranspositionOf)
	assert.Equal(t, "nf3-1", *transpNode.TranspositionOf)
	assert.Empty(t, transpNode.Children)

	// Result should have valid metadata
	assert.True(t, result.Metadata.TotalNodes > 0)
}

func TestMergeTranspositions_NoTranspositions(t *testing.T) {
	// Tree with no transpositions should remain unchanged.
	rootID := "root"
	e4 := mkNode("e4", "fen-e4", strPtr("e4"), 1, "b", &rootID)
	d4 := mkNode("d4", "fen-d4", strPtr("d4"), 1, "b", &rootID)

	root := models.RepertoireNode{
		ID:          rootID,
		FEN:         "startpos",
		MoveNumber:  0,
		ColorToMove: "w",
		Children:    []*models.RepertoireNode{e4, d4},
	}

	var savedTree models.RepertoireNode
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{ID: "rep-1", TreeData: root}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			savedTree = treeData
			return &models.Repertoire{ID: id, TreeData: treeData, Metadata: metadata}, nil
		},
	}

	svc := NewRepertoireService(mockRepo)
	_, err := svc.MergeTranspositions(context.Background(), "user-1", "rep-1")
	require.NoError(t, err)

	// Both nodes should remain unchanged — no transposition
	assert.Nil(t, findNode(&savedTree, "e4").TranspositionOf)
	assert.Nil(t, findNode(&savedTree, "d4").TranspositionOf)
	assert.Equal(t, 2, len(savedTree.Children))
}

func TestMergeTranspositions_CommonChildrenMerged(t *testing.T) {
	// Both branches have child with same move "Nc6" — should not duplicate it.
	posX := "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -"
	rootID := "root"

	nc6a := mkNode("nc6a", "fen-nc6", strPtr("Nc6"), 2, "w", strPtr("nf3-1"))
	nf3Node1 := mkNode("nf3-1", posX, strPtr("Nf3"), 2, "b", strPtr("e5-1"), nc6a)
	e5Node1 := mkNode("e5-1", "fen-e5-1", strPtr("e5"), 1, "w", strPtr("e4-1"), nf3Node1)
	e4Node1 := mkNode("e4-1", "fen-e4", strPtr("e4"), 1, "b", &rootID, e5Node1)

	nc6b := mkNode("nc6b", "fen-nc6", strPtr("Nc6"), 2, "w", strPtr("e4-2"))
	d6 := mkNode("d6", "some-fen-d6", strPtr("d6"), 2, "w", strPtr("e4-2"))
	e4Node2 := mkNode("e4-2", posX, strPtr("e4"), 2, "b", strPtr("e5-2"), nc6b, d6)
	e5Node2 := mkNode("e5-2", "fen-e5-2", strPtr("e5"), 1, "w", strPtr("nf3-2"), e4Node2)
	nf3Node2 := mkNode("nf3-2", "fen-nf3", strPtr("Nf3"), 1, "b", &rootID, e5Node2)

	root := models.RepertoireNode{
		ID:          rootID,
		FEN:         "startpos",
		MoveNumber:  0,
		ColorToMove: "w",
		Children:    []*models.RepertoireNode{e4Node1, nf3Node2},
	}

	var savedTree models.RepertoireNode
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{ID: "rep-1", TreeData: root}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			savedTree = treeData
			return &models.Repertoire{ID: id, TreeData: treeData, Metadata: metadata}, nil
		},
	}

	svc := NewRepertoireService(mockRepo)
	_, err := svc.MergeTranspositions(context.Background(), "user-1", "rep-1")
	require.NoError(t, err)

	canonicalNode := findNode(&savedTree, "nf3-1")
	require.NotNil(t, canonicalNode)
	// Should have Nc6 (original, matched) + d6 (merged) = 2 children, not 3
	assert.Equal(t, 2, len(canonicalNode.Children))

	// Find child moves
	childMoves := make(map[string]bool)
	for _, ch := range canonicalNode.Children {
		if ch.Move != nil {
			childMoves[*ch.Move] = true
		}
	}
	assert.True(t, childMoves["Nc6"])
	assert.True(t, childMoves["d6"])
}

func TestMergeTranspositions_SameFENDifferentMoveNumber(t *testing.T) {
	// Same FEN but different move numbers should NOT be merged.
	posX := "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -"
	rootID := "root"

	node1 := mkNode("n1", posX, strPtr("Nf3"), 2, "b", &rootID)
	node2 := mkNode("n2", posX, strPtr("Nf3"), 3, "b", &rootID)

	root := models.RepertoireNode{
		ID:          rootID,
		FEN:         "startpos",
		MoveNumber:  0,
		ColorToMove: "w",
		Children:    []*models.RepertoireNode{node1, node2},
	}

	var savedTree models.RepertoireNode
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{ID: "rep-1", TreeData: root}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			savedTree = treeData
			return &models.Repertoire{ID: id, TreeData: treeData, Metadata: metadata}, nil
		},
	}

	svc := NewRepertoireService(mockRepo)
	_, err := svc.MergeTranspositions(context.Background(), "user-1", "rep-1")
	require.NoError(t, err)

	// Both nodes should remain unchanged — no transposition
	assert.Nil(t, findNode(&savedTree, "n1").TranspositionOf)
	assert.Nil(t, findNode(&savedTree, "n2").TranspositionOf)
}

// --- SetMainLine tests ---

func TestRepertoireService_SetMainLine_Success(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: id,
				TreeData: models.RepertoireNode{
					ID:  "root",
					FEN: "start",
					Children: []*models.RepertoireNode{
						{
							ID:  "node-a",
							FEN: "fen-a",
							Children: []*models.RepertoireNode{
								{ID: "node-a1", FEN: "fen-a1", Children: []*models.RepertoireNode{}},
							},
						},
						{
							ID:       "node-b",
							FEN:      "fen-b",
							Children: []*models.RepertoireNode{},
						},
					},
				},
			}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, TreeData: treeData}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	rep, err := svc.SetMainLine(context.Background(), "user-1", "rep-1", "node-a1")

	require.NoError(t, err)
	// Path: root -> node-a -> node-a1 should all be main line
	assert.True(t, rep.TreeData.IsMainLine)
	assert.True(t, findNode(&rep.TreeData, "node-a").IsMainLine)
	assert.True(t, findNode(&rep.TreeData, "node-a1").IsMainLine)
	// node-b should NOT be main line
	assert.False(t, findNode(&rep.TreeData, "node-b").IsMainLine)
}

func TestRepertoireService_SetMainLine_OverwritesPrevious(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: id,
				TreeData: models.RepertoireNode{
					ID:         "root",
					FEN:        "start",
					IsMainLine: true,
					Children: []*models.RepertoireNode{
						{
							ID:         "node-a",
							FEN:        "fen-a",
							IsMainLine: true,
							Children:   []*models.RepertoireNode{},
						},
						{
							ID:       "node-b",
							FEN:      "fen-b",
							Children: []*models.RepertoireNode{},
						},
					},
				},
			}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, TreeData: treeData}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	// Set main line to node-b instead of node-a
	rep, err := svc.SetMainLine(context.Background(), "user-1", "rep-1", "node-b")

	require.NoError(t, err)
	assert.True(t, rep.TreeData.IsMainLine)
	assert.False(t, findNode(&rep.TreeData, "node-a").IsMainLine)
	assert.True(t, findNode(&rep.TreeData, "node-b").IsMainLine)
}

func TestRepertoireService_SetMainLine_NodeNotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:       id,
				TreeData: models.RepertoireNode{ID: "root", Children: []*models.RepertoireNode{}},
			}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.SetMainLine(context.Background(), "user-1", "rep-1", "nonexistent")

	assert.ErrorIs(t, err, ErrNodeNotFound)
}

func TestRepertoireService_SetMainLine_RepertoireNotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return nil, repository.ErrRepertoireNotFound
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.SetMainLine(context.Background(), "user-1", "nonexistent", "node")

	assert.ErrorIs(t, err, ErrNotFound)
}

func TestRepertoireService_ClearMainLine_Success(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: id,
				TreeData: models.RepertoireNode{
					ID:         "root",
					FEN:        "start",
					IsMainLine: true,
					Children: []*models.RepertoireNode{
						{
							ID:         "node-a",
							FEN:        "fen-a",
							IsMainLine: true,
							Children: []*models.RepertoireNode{
								{ID: "node-a1", FEN: "fen-a1", IsMainLine: true, Children: []*models.RepertoireNode{}},
							},
						},
					},
				},
			}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, TreeData: treeData}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	rep, err := svc.ClearMainLine(context.Background(), "user-1", "rep-1")

	require.NoError(t, err)
	assert.False(t, rep.TreeData.IsMainLine)
	assert.False(t, findNode(&rep.TreeData, "node-a").IsMainLine)
	assert.False(t, findNode(&rep.TreeData, "node-a1").IsMainLine)
}

// --- UpdateNodeBranchColor tests ---

func TestRepertoireService_UpdateNodeBranchColor_Set(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: id,
				TreeData: models.RepertoireNode{
					ID:  "root",
					FEN: "start",
					Children: []*models.RepertoireNode{
						{ID: "node-1", FEN: "fen1", Children: []*models.RepertoireNode{}},
					},
				},
			}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, TreeData: treeData}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	rep, err := svc.UpdateNodeBranchColor(context.Background(), "user-1", "rep-1", "node-1", "#E74C3C")

	require.NoError(t, err)
	node := findNode(&rep.TreeData, "node-1")
	require.NotNil(t, node)
	require.NotNil(t, node.BranchColor)
	assert.Equal(t, "#E74C3C", *node.BranchColor)
}

func TestRepertoireService_UpdateNodeBranchColor_Clear(t *testing.T) {
	color := "#E74C3C"
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: id,
				TreeData: models.RepertoireNode{
					ID:  "root",
					FEN: "start",
					Children: []*models.RepertoireNode{
						{ID: "node-1", FEN: "fen1", BranchColor: &color, Children: []*models.RepertoireNode{}},
					},
				},
			}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, TreeData: treeData}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	rep, err := svc.UpdateNodeBranchColor(context.Background(), "user-1", "rep-1", "node-1", "")

	require.NoError(t, err)
	node := findNode(&rep.TreeData, "node-1")
	require.NotNil(t, node)
	assert.Nil(t, node.BranchColor)
}

func TestRepertoireService_UpdateNodeBranchColor_InvalidColor(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.UpdateNodeBranchColor(context.Background(), "user-1", "rep-1", "node-1", "#FFFFFF")

	assert.ErrorIs(t, err, ErrInvalidBranchColor)
}

func TestRepertoireService_UpdateNodeBranchColor_NodeNotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:       id,
				TreeData: models.RepertoireNode{ID: "root", Children: []*models.RepertoireNode{}},
			}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.UpdateNodeBranchColor(context.Background(), "user-1", "rep-1", "nonexistent", "#E74C3C")

	assert.ErrorIs(t, err, ErrNodeNotFound)
}

func TestRepertoireService_UpdateNodeBranchColor_RepertoireNotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return nil, repository.ErrRepertoireNotFound
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.UpdateNodeBranchColor(context.Background(), "user-1", "nonexistent", "node", "#E74C3C")

	assert.ErrorIs(t, err, ErrNotFound)
}

// --- UpdateNodeAnnotations tests ---

func annotationRepoWithNode() *mocks.MockRepertoireRepo {
	return &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: id,
				TreeData: models.RepertoireNode{
					ID:  "root",
					FEN: "start",
					Children: []*models.RepertoireNode{
						{ID: "node-1", FEN: "fen1", Children: []*models.RepertoireNode{}},
					},
				},
			}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, TreeData: treeData}, nil
		},
	}
}

func TestRepertoireService_UpdateNodeAnnotations_Set(t *testing.T) {
	svc := NewRepertoireService(annotationRepoWithNode())

	arrows := []models.Arrow{{From: "e2", To: "e4", Color: "#15781B"}}
	highlights := []models.SquareHighlight{{Square: "d4", Color: "#882020"}}

	rep, err := svc.UpdateNodeAnnotations(context.Background(), "user-1", "rep-1", "node-1", arrows, highlights)

	require.NoError(t, err)
	node := findNode(&rep.TreeData, "node-1")
	require.NotNil(t, node)
	require.Len(t, node.Arrows, 1)
	assert.Equal(t, "e2", node.Arrows[0].From)
	require.Len(t, node.Highlights, 1)
	assert.Equal(t, "d4", node.Highlights[0].Square)
}

func TestRepertoireService_UpdateNodeAnnotations_Clear(t *testing.T) {
	arrows := []models.Arrow{{From: "e2", To: "e4", Color: "#15781B"}}
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: id,
				TreeData: models.RepertoireNode{
					ID:  "root",
					FEN: "start",
					Children: []*models.RepertoireNode{
						{ID: "node-1", FEN: "fen1", Arrows: arrows, Children: []*models.RepertoireNode{}},
					},
				},
			}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, TreeData: treeData}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	rep, err := svc.UpdateNodeAnnotations(context.Background(), "user-1", "rep-1", "node-1", nil, nil)

	require.NoError(t, err)
	node := findNode(&rep.TreeData, "node-1")
	require.NotNil(t, node)
	assert.Nil(t, node.Arrows)
	assert.Nil(t, node.Highlights)
}

func TestRepertoireService_UpdateNodeAnnotations_InvalidColor(t *testing.T) {
	svc := NewRepertoireService(annotationRepoWithNode())

	arrows := []models.Arrow{{From: "e2", To: "e4", Color: "#FFFFFF"}}

	_, err := svc.UpdateNodeAnnotations(context.Background(), "user-1", "rep-1", "node-1", arrows, nil)

	assert.ErrorIs(t, err, ErrInvalidAnnotation)
}

func TestRepertoireService_UpdateNodeAnnotations_InvalidSquare(t *testing.T) {
	svc := NewRepertoireService(annotationRepoWithNode())

	highlights := []models.SquareHighlight{{Square: "z9", Color: "#15781B"}}

	_, err := svc.UpdateNodeAnnotations(context.Background(), "user-1", "rep-1", "node-1", nil, highlights)

	assert.ErrorIs(t, err, ErrInvalidAnnotation)
}

func TestRepertoireService_UpdateNodeAnnotations_NodeNotFound(t *testing.T) {
	svc := NewRepertoireService(annotationRepoWithNode())

	_, err := svc.UpdateNodeAnnotations(context.Background(), "user-1", "rep-1", "nonexistent", nil, nil)

	assert.ErrorIs(t, err, ErrNodeNotFound)
}

func TestRepertoireService_UpdateNodeAnnotations_RepertoireNotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return nil, repository.ErrRepertoireNotFound
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.UpdateNodeAnnotations(context.Background(), "user-1", "nonexistent", "node", nil, nil)

	assert.ErrorIs(t, err, ErrNotFound)
}

func TestRepertoireService_ClearMainLine_RepertoireNotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return nil, repository.ErrRepertoireNotFound
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.ClearMainLine(context.Background(), "user-1", "nonexistent")

	assert.ErrorIs(t, err, ErrNotFound)
}

// --- UpdateVisibility tests ---

func TestRepertoireService_UpdateVisibility_Success(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		BelongsToUserFunc: func(_ context.Context, id, userID string) (bool, error) { return true, nil },
		UpdateVisibilityFunc: func(_ context.Context, id string, userID string, isPublic bool) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, IsPublic: isPublic}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	rep, err := svc.UpdateVisibility(context.Background(), "user-1", "rep-1", false)

	require.NoError(t, err)
	assert.Equal(t, "rep-1", rep.ID)
	assert.False(t, rep.IsPublic)
}

func TestRepertoireService_UpdateVisibility_MakePublic(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		BelongsToUserFunc: func(_ context.Context, id, userID string) (bool, error) { return true, nil },
		UpdateVisibilityFunc: func(_ context.Context, id string, userID string, isPublic bool) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, IsPublic: isPublic}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	rep, err := svc.UpdateVisibility(context.Background(), "user-1", "rep-1", true)

	require.NoError(t, err)
	assert.True(t, rep.IsPublic)
}

func TestRepertoireService_UpdateVisibility_NotOwner(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		BelongsToUserFunc: func(_ context.Context, id, userID string) (bool, error) { return false, nil },
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.UpdateVisibility(context.Background(), "other-user", "rep-1", true)

	assert.ErrorIs(t, err, ErrNotFound)
}

func TestRepertoireService_UpdateVisibility_OwnershipCheckError(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		BelongsToUserFunc: func(_ context.Context, id, userID string) (bool, error) {
			return false, assert.AnError
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.UpdateVisibility(context.Background(), "user-1", "rep-1", true)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to check ownership")
}

// --- ListPublicRepertoires tests ---

func TestRepertoireService_ListPublicRepertoires_Success(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetAllPublicFunc: func(_ context.Context) ([]models.Repertoire, error) {
			return []models.Repertoire{
				{ID: "rep-1", Name: "Sicilian Defense", IsPublic: true, AuthorName: "alice"},
				{ID: "rep-2", Name: "French Defense", IsPublic: true, AuthorName: "bob"},
			}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	reps, err := svc.ListPublicRepertoires(context.Background())

	require.NoError(t, err)
	assert.Len(t, reps, 2)
	assert.Equal(t, "alice", reps[0].AuthorName)
	assert.Equal(t, "bob", reps[1].AuthorName)
}

func TestRepertoireService_ListPublicRepertoires_Empty(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetAllPublicFunc: func(_ context.Context) ([]models.Repertoire, error) {
			return []models.Repertoire{}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	reps, err := svc.ListPublicRepertoires(context.Background())

	require.NoError(t, err)
	assert.Empty(t, reps)
}

func TestRepertoireService_ListPublicRepertoires_RepoError(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetAllPublicFunc: func(_ context.Context) ([]models.Repertoire, error) {
			return nil, assert.AnError
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.ListPublicRepertoires(context.Background())

	assert.Error(t, err)
	assert.ErrorIs(t, err, assert.AnError)
}

// --- GetPublicRepertoire tests ---

func TestRepertoireService_GetPublicRepertoire_Success(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetPublicByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:         id,
				Name:       "Sicilian Defense",
				IsPublic:   true,
				AuthorName: "alice",
				TreeData: models.RepertoireNode{
					ID:  "root",
					FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
				},
			}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	rep, err := svc.GetPublicRepertoire(context.Background(), "rep-1")

	require.NoError(t, err)
	assert.Equal(t, "rep-1", rep.ID)
	assert.Equal(t, "Sicilian Defense", rep.Name)
	assert.True(t, rep.IsPublic)
	assert.Equal(t, "alice", rep.AuthorName)
}

func TestRepertoireService_GetPublicRepertoire_NotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetPublicByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return nil, repository.ErrRepertoireNotFound
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.GetPublicRepertoire(context.Background(), "nonexistent")

	assert.Error(t, err)
	assert.ErrorIs(t, err, ErrNotFound)
}

func TestRepertoireService_GetPublicRepertoire_PrivateRepertoireNotFound(t *testing.T) {
	// A private repertoire should not be returned by GetPublicRepertoire
	mockRepo := &mocks.MockRepertoireRepo{
		GetPublicByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return nil, repository.ErrRepertoireNotFound
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.GetPublicRepertoire(context.Background(), "private-rep")

	assert.ErrorIs(t, err, ErrNotFound)
}

func TestRepertoireService_GetPublicRepertoire_RepoError(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetPublicByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return nil, assert.AnError
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.GetPublicRepertoire(context.Background(), "rep-1")

	assert.Error(t, err)
	assert.ErrorIs(t, err, assert.AnError)
}

// --- ImportRepertoire tests ---

func TestRepertoireService_ImportRepertoire_Success(t *testing.T) {
	move := "e4"
	sourceTree := models.RepertoireNode{
		ID:  "source-root",
		FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Children: []*models.RepertoireNode{
			{
				ID:       "source-child",
				FEN:      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -",
				Move:     &move,
				Children: []*models.RepertoireNode{},
			},
		},
	}

	var savedTree models.RepertoireNode
	mockRepo := &mocks.MockRepertoireRepo{
		GetPublicByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:       "source-rep",
				Name:     "Sicilian Defense",
				Color:    models.ColorWhite,
				IsPublic: true,
				TreeData: sourceTree,
			}, nil
		},
		GetOwnerIDFunc: func(_ context.Context, id string) (string, error) {
			return "other-user", nil
		},
		CountFunc: func(_ context.Context, userID string) (int, error) { return 5, nil },
		CreateWithIsPublicFunc: func(_ context.Context, userID, name string, color models.Color, isPublic bool) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:       "new-rep",
				Name:     name,
				Color:    color,
				IsPublic: isPublic,
			}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			savedTree = treeData
			return &models.Repertoire{
				ID:       id,
				Name:     "Sicilian Defense",
				Color:    models.ColorWhite,
				TreeData: treeData,
				Metadata: metadata,
			}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	rep, err := svc.ImportRepertoire(context.Background(), "user-1", "source-rep")

	require.NoError(t, err)
	assert.Equal(t, "new-rep", rep.ID)
	assert.Equal(t, "Sicilian Defense", rep.Name)

	// The cloned tree should have the same structure but different IDs
	assert.NotEqual(t, "source-root", savedTree.ID)
	assert.Len(t, savedTree.Children, 1)
	assert.NotEqual(t, "source-child", savedTree.Children[0].ID)
	assert.Equal(t, "e4", *savedTree.Children[0].Move)
}

func TestRepertoireService_ImportRepertoire_DeepClone(t *testing.T) {
	// Verify that importing creates a deep clone with new UUIDs at all levels
	move1 := "e4"
	move2 := "e5"
	move3 := "Nf3"
	sourceTree := models.RepertoireNode{
		ID:  "root",
		FEN: "start",
		Children: []*models.RepertoireNode{
			{
				ID:   "l1",
				Move: &move1,
				FEN:  "fen1",
				Children: []*models.RepertoireNode{
					{
						ID:   "l2",
						Move: &move2,
						FEN:  "fen2",
						Children: []*models.RepertoireNode{
							{ID: "l3", Move: &move3, FEN: "fen3", Children: []*models.RepertoireNode{}},
						},
					},
				},
			},
		},
	}

	var savedTree models.RepertoireNode
	mockRepo := &mocks.MockRepertoireRepo{
		GetPublicByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: "source", Name: "Deep", Color: models.ColorWhite,
				IsPublic: true, TreeData: sourceTree,
			}, nil
		},
		GetOwnerIDFunc: func(_ context.Context, id string) (string, error) { return "other-user", nil },
		CountFunc:      func(_ context.Context, userID string) (int, error) { return 0, nil },
		CreateWithIsPublicFunc: func(_ context.Context, userID, name string, color models.Color, isPublic bool) (*models.Repertoire, error) {
			assert.False(t, isPublic, "Imported repertoire should be private")
			return &models.Repertoire{ID: "new", Name: name, Color: color, IsPublic: isPublic}, nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			savedTree = treeData
			return &models.Repertoire{ID: id, TreeData: treeData, Metadata: metadata}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.ImportRepertoire(context.Background(), "user-1", "source")

	require.NoError(t, err)

	// Verify all IDs are different from source
	assert.NotEqual(t, "root", savedTree.ID)
	child := savedTree.Children[0]
	assert.NotEqual(t, "l1", child.ID)
	assert.Equal(t, "e4", *child.Move)
	grandchild := child.Children[0]
	assert.NotEqual(t, "l2", grandchild.ID)
	assert.Equal(t, "e5", *grandchild.Move)
	greatGrandchild := grandchild.Children[0]
	assert.NotEqual(t, "l3", greatGrandchild.ID)
	assert.Equal(t, "Nf3", *greatGrandchild.Move)
}

func TestRepertoireService_ImportRepertoire_CannotImportOwn(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetPublicByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: id, Name: "My Rep", Color: models.ColorWhite,
				IsPublic: true, TreeData: models.RepertoireNode{ID: "root"},
			}, nil
		},
		GetOwnerIDFunc: func(_ context.Context, id string) (string, error) {
			return "user-1", nil // Same as the requesting user
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.ImportRepertoire(context.Background(), "user-1", "rep-1")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "cannot import your own repertoire")
}

func TestRepertoireService_ImportRepertoire_SourceNotPublic(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetPublicByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return nil, repository.ErrRepertoireNotFound
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.ImportRepertoire(context.Background(), "user-1", "private-rep")

	assert.ErrorIs(t, err, ErrNotFound)
}

func TestRepertoireService_ImportRepertoire_LimitReached(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetPublicByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: id, Name: "Rep", Color: models.ColorWhite,
				IsPublic: true, TreeData: models.RepertoireNode{ID: "root"},
			}, nil
		},
		GetOwnerIDFunc: func(_ context.Context, id string) (string, error) { return "other-user", nil },
		CountFunc:      func(_ context.Context, userID string) (int, error) { return 50, nil },
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.ImportRepertoire(context.Background(), "user-1", "rep-1")

	assert.ErrorIs(t, err, ErrLimitReached)
}

func TestRepertoireService_ImportRepertoire_OwnerLookupError(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetPublicByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: id, Name: "Rep", Color: models.ColorWhite,
				IsPublic: true, TreeData: models.RepertoireNode{ID: "root"},
			}, nil
		},
		GetOwnerIDFunc: func(_ context.Context, id string) (string, error) {
			return "", assert.AnError
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.ImportRepertoire(context.Background(), "user-1", "rep-1")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get owner")
}

// --- CreateRepertoireWithVisibility tests ---

func TestRepertoireService_CreateRepertoireWithVisibility_Public(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		CountFunc: func(_ context.Context, userID string) (int, error) { return 0, nil },
		CreateWithIsPublicFunc: func(_ context.Context, userID, name string, color models.Color, isPublic bool) (*models.Repertoire, error) {
			return &models.Repertoire{ID: "new-rep", Name: name, Color: color, IsPublic: isPublic}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	rep, err := svc.CreateRepertoireWithVisibility(context.Background(), "user-1", "My Public Rep", "", models.ColorWhite, true)

	require.NoError(t, err)
	assert.True(t, rep.IsPublic)
	assert.Equal(t, "My Public Rep", rep.Name)
}

func TestRepertoireService_CreateRepertoireWithVisibility_Private(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		CountFunc: func(_ context.Context, userID string) (int, error) { return 0, nil },
		CreateWithIsPublicFunc: func(_ context.Context, userID, name string, color models.Color, isPublic bool) (*models.Repertoire, error) {
			return &models.Repertoire{ID: "new-rep", Name: name, Color: color, IsPublic: isPublic}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	rep, err := svc.CreateRepertoireWithVisibility(context.Background(), "user-1", "My Private Rep", "", models.ColorBlack, false)

	require.NoError(t, err)
	assert.False(t, rep.IsPublic)
}

func TestRepertoireService_CreateRepertoireWithVisibility_InvalidColor(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.CreateRepertoireWithVisibility(context.Background(), "user-1", "Rep", "", models.Color("invalid"), true)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid color")
}

func TestRepertoireService_CreateRepertoireWithVisibility_EmptyName(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.CreateRepertoireWithVisibility(context.Background(), "user-1", "", "", models.ColorWhite, true)

	assert.ErrorIs(t, err, ErrNameRequired)
}

func TestRepertoireService_CreateRepertoireWithVisibility_LimitReached(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		CountFunc: func(_ context.Context, userID string) (int, error) { return 50, nil },
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.CreateRepertoireWithVisibility(context.Background(), "user-1", "Rep", "", models.ColorWhite, true)

	assert.ErrorIs(t, err, ErrLimitReached)
}

// --- CreateRepertoire delegates to CreateRepertoireWithVisibility ---

func TestRepertoireService_CreateRepertoire_DefaultsToPrivate(t *testing.T) {
	var receivedIsPublic bool
	mockRepo := &mocks.MockRepertoireRepo{
		CountFunc: func(_ context.Context, userID string) (int, error) { return 0, nil },
		CreateWithIsPublicFunc: func(_ context.Context, userID, name string, color models.Color, isPublic bool) (*models.Repertoire, error) {
			receivedIsPublic = isPublic
			return &models.Repertoire{ID: "new-rep", Name: name, Color: color, IsPublic: isPublic}, nil
		},
	}
	svc := NewRepertoireService(mockRepo)

	_, err := svc.CreateRepertoire(context.Background(), "user-1", "Test", models.ColorWhite)

	require.NoError(t, err)
	assert.False(t, receivedIsPublic, "CreateRepertoire should default to private (isPublic=false)")
}

// findNodeByMove recursively finds the first node whose Move equals the given SAN.
func findNodeByMove(root *models.RepertoireNode, san string) *models.RepertoireNode {
	if root == nil {
		return nil
	}
	if root.Move != nil && *root.Move == san {
		return root
	}
	for _, child := range root.Children {
		if found := findNodeByMove(child, san); found != nil {
			return found
		}
	}
	return nil
}
