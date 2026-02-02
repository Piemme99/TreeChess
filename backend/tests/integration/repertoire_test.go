//go:build integration

package integration

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
	"github.com/treechess/backend/internal/services"
	"github.com/treechess/backend/internal/testhelpers"
)

var testDB *testhelpers.TestDB

func TestMain(m *testing.M) {
	testDB = testhelpers.MustSetupTestDB()
	code := m.Run()
	testDB.Teardown()
	os.Exit(code)
}

func TestRepertoireRepo_CRUD(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "cruduser", "password123")

	// Create
	rep, err := repos.Repertoire.Create(user.ID, "My Repertoire", models.ColorWhite)
	require.NoError(t, err)
	require.NotEmpty(t, rep.ID)
	assert.Equal(t, "My Repertoire", rep.Name)
	assert.Equal(t, models.ColorWhite, rep.Color)

	// GetByID
	got, err := repos.Repertoire.GetByID(rep.ID)
	require.NoError(t, err)
	assert.Equal(t, rep.ID, got.ID)
	assert.Equal(t, "My Repertoire", got.Name)

	// GetAll
	all, err := repos.Repertoire.GetAll(user.ID)
	require.NoError(t, err)
	assert.Len(t, all, 1)

	// GetByColor
	whites, err := repos.Repertoire.GetByColor(user.ID, models.ColorWhite)
	require.NoError(t, err)
	assert.Len(t, whites, 1)

	blacks, err := repos.Repertoire.GetByColor(user.ID, models.ColorBlack)
	require.NoError(t, err)
	assert.Len(t, blacks, 0)

	// UpdateName
	updated, err := repos.Repertoire.UpdateName(rep.ID, "Renamed")
	require.NoError(t, err)
	assert.Equal(t, "Renamed", updated.Name)

	// Delete
	err = repos.Repertoire.Delete(rep.ID)
	require.NoError(t, err)

	// GetByID after delete returns ErrRepertoireNotFound
	_, err = repos.Repertoire.GetByID(rep.ID)
	assert.ErrorIs(t, err, repository.ErrRepertoireNotFound)
}

func TestRepertoireService_CreateRepertoire_Validations(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "valuser", "password123")
	svc := services.NewRepertoireService(repos.Repertoire)

	// Invalid color
	_, err := svc.CreateRepertoire(user.ID, "Test", "red")
	assert.ErrorIs(t, err, services.ErrInvalidColor)

	// Empty name
	_, err = svc.CreateRepertoire(user.ID, "", models.ColorWhite)
	assert.ErrorIs(t, err, services.ErrNameRequired)

	// Name too long (> 100 chars)
	longName := strings.Repeat("a", 101)
	_, err = svc.CreateRepertoire(user.ID, longName, models.ColorWhite)
	assert.ErrorIs(t, err, services.ErrNameTooLong)

	// Valid creation succeeds
	rep, err := svc.CreateRepertoire(user.ID, "Valid Rep", models.ColorWhite)
	require.NoError(t, err)
	assert.Equal(t, "Valid Rep", rep.Name)
	assert.Equal(t, models.ColorWhite, rep.Color)
}

func TestRepertoireService_CreateRepertoire_RootNode(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "rootuser", "password123")
	svc := services.NewRepertoireService(repos.Repertoire)

	rep, err := svc.CreateRepertoire(user.ID, "Test", models.ColorWhite)
	require.NoError(t, err)

	// Root node should have the starting FEN
	root := rep.TreeData
	assert.NotEmpty(t, root.ID)
	assert.Contains(t, root.FEN, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR")
	assert.Nil(t, root.Move) // Root has no move
	assert.Equal(t, models.ChessColorWhite, root.ColorToMove)
	assert.Empty(t, root.Children)

	// Initial metadata should be 1 node (root), 0 moves, 0 depth
	assert.Equal(t, 1, rep.Metadata.TotalNodes)
	assert.Equal(t, 0, rep.Metadata.TotalMoves)
	assert.Equal(t, 0, rep.Metadata.DeepestDepth)
}

func TestRepertoireService_AddNode_RealDB(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "addnodeuser", "password123")
	svc := services.NewRepertoireService(repos.Repertoire)

	rep, err := svc.CreateRepertoire(user.ID, "e4 Repertoire", models.ColorWhite)
	require.NoError(t, err)

	// Add e4 to root
	rootID := rep.TreeData.ID
	rep, err = svc.AddNode(rep.ID, models.AddNodeRequest{
		ParentID:   rootID,
		Move:       "e4",
		MoveNumber: 1,
	})
	require.NoError(t, err)

	// Re-read from DB to verify JSONB persistence
	got, err := svc.GetRepertoire(rep.ID)
	require.NoError(t, err)

	assert.Len(t, got.TreeData.Children, 1)
	child := got.TreeData.Children[0]
	assert.NotNil(t, child.Move)
	assert.Equal(t, "e4", *child.Move)
	assert.Contains(t, child.FEN, "4P3") // FEN should show pawn on e4
	assert.Equal(t, models.ChessColorBlack, child.ColorToMove)

	// Check metadata
	assert.Equal(t, 2, got.Metadata.TotalNodes)
	assert.Equal(t, 1, got.Metadata.TotalMoves)
	assert.Equal(t, 1, got.Metadata.DeepestDepth)
}

func TestRepertoireService_AddNode_DuplicateMove(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "dupuser", "password123")
	svc := services.NewRepertoireService(repos.Repertoire)

	rep, _ := svc.CreateRepertoire(user.ID, "Dup Test", models.ColorWhite)
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: rep.TreeData.ID, Move: "e4", MoveNumber: 1})

	// Adding e4 again to root should fail
	_, err := svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: rep.TreeData.ID, Move: "e4", MoveNumber: 1})
	assert.ErrorIs(t, err, services.ErrMoveExists)
}

func TestRepertoireService_AddNode_IllegalMove(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "illegaluser", "password123")
	svc := services.NewRepertoireService(repos.Repertoire)

	rep, _ := svc.CreateRepertoire(user.ID, "Illegal Test", models.ColorWhite)

	// "Qd7" is illegal from the starting position
	_, err := svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: rep.TreeData.ID, Move: "Qd7", MoveNumber: 1})
	assert.ErrorIs(t, err, services.ErrInvalidMove)
}

func TestRepertoireService_AddMultipleNodes(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "multinode", "password123")
	svc := services.NewRepertoireService(repos.Repertoire)

	rep, err := svc.CreateRepertoire(user.ID, "Multi", models.ColorWhite)
	require.NoError(t, err)

	rootID := rep.TreeData.ID

	// e4
	rep, err = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: rootID, Move: "e4", MoveNumber: 1})
	require.NoError(t, err)
	e4ID := rep.TreeData.Children[0].ID

	// e4 -> e5
	rep, err = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: e4ID, Move: "e5", MoveNumber: 1})
	require.NoError(t, err)
	e5ID := rep.TreeData.Children[0].Children[0].ID

	// e4 -> e5 -> Nf3
	rep, err = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: e5ID, Move: "Nf3", MoveNumber: 2})
	require.NoError(t, err)

	// d4 as sibling of e4
	rep, err = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: rootID, Move: "d4", MoveNumber: 1})
	require.NoError(t, err)

	// Verify from DB
	got, err := svc.GetRepertoire(rep.ID)
	require.NoError(t, err)

	// Root should have 2 children (e4, d4)
	assert.Len(t, got.TreeData.Children, 2)
	// e4 branch should have depth 3 (e4 -> e5 -> Nf3)
	assert.Len(t, got.TreeData.Children[0].Children, 1)
	assert.Len(t, got.TreeData.Children[0].Children[0].Children, 1)

	assert.Equal(t, 5, got.Metadata.TotalNodes)
	assert.Equal(t, 4, got.Metadata.TotalMoves)
	assert.Equal(t, 3, got.Metadata.DeepestDepth)
}

func TestRepertoireService_DeleteNode_RealDB(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "delnode", "password123")
	svc := services.NewRepertoireService(repos.Repertoire)

	rep, err := svc.CreateRepertoire(user.ID, "Delete Test", models.ColorWhite)
	require.NoError(t, err)
	rootID := rep.TreeData.ID

	// Build e4 -> e5 -> Nf3
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: rootID, Move: "e4", MoveNumber: 1})
	e4ID := rep.TreeData.Children[0].ID
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: e4ID, Move: "e5", MoveNumber: 1})
	e5ID := rep.TreeData.Children[0].Children[0].ID
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: e5ID, Move: "Nf3", MoveNumber: 2})

	// Delete e5 (should cascade and remove Nf3 too)
	rep, err = svc.DeleteNode(rep.ID, e5ID)
	require.NoError(t, err)

	got, err := svc.GetRepertoire(rep.ID)
	require.NoError(t, err)

	// e4 should have no children
	assert.Len(t, got.TreeData.Children, 1)
	assert.Len(t, got.TreeData.Children[0].Children, 0)

	// Metadata recalculated: root + e4 = 2 nodes, 1 move
	assert.Equal(t, 2, got.Metadata.TotalNodes)
	assert.Equal(t, 1, got.Metadata.TotalMoves)
}

func TestRepertoireService_DeleteNode_CannotDeleteRoot(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "delroot", "password123")
	svc := services.NewRepertoireService(repos.Repertoire)

	rep, _ := svc.CreateRepertoire(user.ID, "Root Test", models.ColorWhite)

	_, err := svc.DeleteNode(rep.ID, rep.TreeData.ID)
	assert.ErrorIs(t, err, services.ErrCannotDeleteRoot)
}

func TestRepertoireService_MergeRepertoires_RealDB(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "mergeuser", "password123")
	svc := services.NewRepertoireService(repos.Repertoire)

	// Create repertoire with e4
	rep1, _ := svc.CreateRepertoire(user.ID, "e4 Rep", models.ColorWhite)
	rep1, _ = svc.AddNode(rep1.ID, models.AddNodeRequest{ParentID: rep1.TreeData.ID, Move: "e4", MoveNumber: 1})

	// Create repertoire with d4
	rep2, _ := svc.CreateRepertoire(user.ID, "d4 Rep", models.ColorWhite)
	rep2, _ = svc.AddNode(rep2.ID, models.AddNodeRequest{ParentID: rep2.TreeData.ID, Move: "d4", MoveNumber: 1})

	rep1ID := rep1.ID
	rep2ID := rep2.ID

	// Merge
	result, err := svc.MergeRepertoires(user.ID, []string{rep1ID, rep2ID}, "Merged Rep")
	require.NoError(t, err)

	merged := result.Merged
	assert.Equal(t, "Merged Rep", merged.Name)
	assert.Len(t, merged.TreeData.Children, 2)

	// Verify both moves are present
	moves := make([]string, 0)
	for _, child := range merged.TreeData.Children {
		if child.Move != nil {
			moves = append(moves, *child.Move)
		}
	}
	assert.Contains(t, moves, "e4")
	assert.Contains(t, moves, "d4")

	// Source repertoires should be deleted
	_, err = svc.GetRepertoire(rep1ID)
	assert.ErrorIs(t, err, services.ErrNotFound)
	_, err = svc.GetRepertoire(rep2ID)
	assert.ErrorIs(t, err, services.ErrNotFound)
}

func TestRepertoireService_MergeRepertoires_ColorMismatch(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "mergemismatch", "password123")
	svc := services.NewRepertoireService(repos.Repertoire)

	rep1, _ := svc.CreateRepertoire(user.ID, "White Rep", models.ColorWhite)
	rep2, _ := svc.CreateRepertoire(user.ID, "Black Rep", models.ColorBlack)

	_, err := svc.MergeRepertoires(user.ID, []string{rep1.ID, rep2.ID}, "Mixed")
	assert.ErrorIs(t, err, services.ErrMergeColorMismatch)
}

func TestRepertoireService_ExtractSubtree_RealDB(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "extractuser", "password123")
	svc := services.NewRepertoireService(repos.Repertoire)

	// Build e4 -> e5 -> Nf3
	rep, _ := svc.CreateRepertoire(user.ID, "Full Rep", models.ColorWhite)
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: rep.TreeData.ID, Move: "e4", MoveNumber: 1})
	e4ID := rep.TreeData.Children[0].ID
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: e4ID, Move: "e5", MoveNumber: 1})
	e5ID := rep.TreeData.Children[0].Children[0].ID
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: e5ID, Move: "Nf3", MoveNumber: 2})

	// Extract from e4 node
	result, err := svc.ExtractSubtree(user.ID, rep.ID, e4ID, "Extracted")
	require.NoError(t, err)

	// Original should have e4 removed
	origFromDB, err := svc.GetRepertoire(rep.ID)
	require.NoError(t, err)
	assert.Len(t, origFromDB.TreeData.Children, 0)
	assert.Equal(t, 1, origFromDB.Metadata.TotalNodes) // only root
	assert.Equal(t, 0, origFromDB.Metadata.TotalMoves)

	// Extracted should be persisted and have correct structure
	extracted := result.Extracted
	assert.Equal(t, "Extracted", extracted.Name)
	assert.Equal(t, models.ColorWhite, extracted.Color)

	extractedFromDB, err := svc.GetRepertoire(extracted.ID)
	require.NoError(t, err)
	assert.True(t, extractedFromDB.Metadata.TotalMoves >= 2,
		"extracted should have at least e5 and Nf3 moves, got %d", extractedFromDB.Metadata.TotalMoves)
}

func TestRepertoireService_ExtractSubtree_CannotExtractRoot(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "extractroot", "password123")
	svc := services.NewRepertoireService(repos.Repertoire)

	rep, _ := svc.CreateRepertoire(user.ID, "Test", models.ColorWhite)

	_, err := svc.ExtractSubtree(user.ID, rep.ID, rep.TreeData.ID, "Bad")
	assert.ErrorIs(t, err, services.ErrCannotExtractRoot)
}

func TestRepertoireService_MergeTranspositions_RealDB(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "transpuser", "password123")
	svc := services.NewRepertoireService(repos.Repertoire)

	rep, _ := svc.CreateRepertoire(user.ID, "Transpositions", models.ColorWhite)
	rootID := rep.TreeData.ID

	// Path 1: 1.e4 e5 2.Nf3 Nc6 3.Bc4
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: rootID, Move: "e4", MoveNumber: 1})
	e4ID := rep.TreeData.Children[0].ID
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: e4ID, Move: "e5", MoveNumber: 1})
	e5AfterE4 := rep.TreeData.Children[0].Children[0].ID
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: e5AfterE4, Move: "Nf3", MoveNumber: 2})
	nf3AfterE5 := rep.TreeData.Children[0].Children[0].Children[0].ID
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: nf3AfterE5, Move: "Nc6", MoveNumber: 2})
	nc6AfterNf3 := rep.TreeData.Children[0].Children[0].Children[0].Children[0].ID
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: nc6AfterNf3, Move: "Bc4", MoveNumber: 3})

	// Path 2: 1.Nf3 Nc6 2.e4 e5 3.Bc4
	// Both paths reach the same position after Bc4 (no en passant difference)
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: rootID, Move: "Nf3", MoveNumber: 1})
	nf3ID := rep.TreeData.Children[1].ID
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: nf3ID, Move: "Nc6", MoveNumber: 1})
	nc6AfterNf3Root := rep.TreeData.Children[1].Children[0].ID
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: nc6AfterNf3Root, Move: "e4", MoveNumber: 2})
	e4AfterNc6 := rep.TreeData.Children[1].Children[0].Children[0].ID
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: e4AfterNc6, Move: "e5", MoveNumber: 2})
	e5AfterE4Path2 := rep.TreeData.Children[1].Children[0].Children[0].Children[0].ID
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: e5AfterE4Path2, Move: "Bc4", MoveNumber: 3})

	nodeCountBefore := rep.Metadata.TotalNodes

	// Merge transpositions
	merged, err := svc.MergeTranspositions(rep.ID)
	require.NoError(t, err)
	require.NotNil(t, merged)

	// Re-read from DB to verify persistence
	got, err := svc.GetRepertoire(rep.ID)
	require.NoError(t, err)

	// Check that at least one TranspositionOf marker exists in the tree
	hasTransposition := false
	var walkTree func(node *models.RepertoireNode)
	walkTree = func(node *models.RepertoireNode) {
		if node.TranspositionOf != nil {
			hasTransposition = true
		}
		for _, child := range node.Children {
			walkTree(child)
		}
	}
	walkTree(&got.TreeData)
	assert.True(t, hasTransposition, "should have at least one transposition marker after merge")

	// After merging transpositions, node count should not increase
	assert.LessOrEqual(t, got.Metadata.TotalNodes, nodeCountBefore)
}

func TestRepertoireService_UpdateNodeComment(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "commentuser", "password123")
	svc := services.NewRepertoireService(repos.Repertoire)

	rep, _ := svc.CreateRepertoire(user.ID, "Comment Test", models.ColorWhite)
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: rep.TreeData.ID, Move: "e4", MoveNumber: 1})
	e4ID := rep.TreeData.Children[0].ID

	// Add comment
	rep, err := svc.UpdateNodeComment(rep.ID, e4ID, "King's pawn opening")
	require.NoError(t, err)

	got, _ := svc.GetRepertoire(rep.ID)
	e4Node := got.TreeData.Children[0]
	require.NotNil(t, e4Node.Comment)
	assert.Equal(t, "King's pawn opening", *e4Node.Comment)

	// Modify comment
	rep, err = svc.UpdateNodeComment(rep.ID, e4ID, "Updated comment")
	require.NoError(t, err)

	got, _ = svc.GetRepertoire(rep.ID)
	require.NotNil(t, got.TreeData.Children[0].Comment)
	assert.Equal(t, "Updated comment", *got.TreeData.Children[0].Comment)

	// Remove comment (empty string)
	rep, err = svc.UpdateNodeComment(rep.ID, e4ID, "")
	require.NoError(t, err)

	got, _ = svc.GetRepertoire(rep.ID)
	assert.Nil(t, got.TreeData.Children[0].Comment)
}

func TestRepertoireService_SaveTree_JSONBIntegrity(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "jsonbuser", "password123")
	svc := services.NewRepertoireService(repos.Repertoire)

	// Build a complex tree
	rep, _ := svc.CreateRepertoire(user.ID, "JSONB Test", models.ColorWhite)
	rootID := rep.TreeData.ID

	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: rootID, Move: "e4", MoveNumber: 1})
	e4ID := rep.TreeData.Children[0].ID
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: rootID, Move: "d4", MoveNumber: 1})
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: e4ID, Move: "e5", MoveNumber: 1})
	rep, _ = svc.AddNode(rep.ID, models.AddNodeRequest{ParentID: e4ID, Move: "c5", MoveNumber: 1})

	// Serialize tree, save, re-read, compare
	treeJSON1, err := json.Marshal(rep.TreeData)
	require.NoError(t, err)

	// Save the tree directly
	saved, err := svc.SaveTree(rep.ID, rep.TreeData)
	require.NoError(t, err)

	treeJSON2, err := json.Marshal(saved.TreeData)
	require.NoError(t, err)

	// Re-read from DB
	got, err := svc.GetRepertoire(rep.ID)
	require.NoError(t, err)

	treeJSON3, err := json.Marshal(got.TreeData)
	require.NoError(t, err)

	// All three JSON representations should be equal
	assert.JSONEq(t, string(treeJSON1), string(treeJSON2))
	assert.JSONEq(t, string(treeJSON2), string(treeJSON3))
}

func TestRepertoire_BelongsToUser(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user1 := testhelpers.SeedUser(t, repos, "owner1", "password123")
	user2 := testhelpers.SeedUser(t, repos, "owner2", "password123")

	rep := testhelpers.SeedRepertoire(t, repos, user1.ID, "User1 Rep", models.ColorWhite)

	belongs, err := repos.Repertoire.BelongsToUser(rep.ID, user1.ID)
	require.NoError(t, err)
	assert.True(t, belongs)

	belongs, err = repos.Repertoire.BelongsToUser(rep.ID, user2.ID)
	require.NoError(t, err)
	assert.False(t, belongs)
}

func TestRepertoire_Count(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "countuser", "password123")

	testhelpers.SeedRepertoire(t, repos, user.ID, "Rep 1", models.ColorWhite)
	testhelpers.SeedRepertoire(t, repos, user.ID, "Rep 2", models.ColorBlack)
	testhelpers.SeedRepertoire(t, repos, user.ID, "Rep 3", models.ColorWhite)

	count, err := repos.Repertoire.Count(user.ID)
	require.NoError(t, err)
	assert.Equal(t, 3, count)
}

func TestRepertoireService_CheckOwnership(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user1 := testhelpers.SeedUser(t, repos, "owncheck1", "password123")
	user2 := testhelpers.SeedUser(t, repos, "owncheck2", "password123")
	svc := services.NewRepertoireService(repos.Repertoire)

	rep, _ := svc.CreateRepertoire(user1.ID, "Test", models.ColorWhite)

	err := svc.CheckOwnership(rep.ID, user1.ID)
	assert.NoError(t, err)

	err = svc.CheckOwnership(rep.ID, user2.ID)
	assert.ErrorIs(t, err, services.ErrNotFound)
}
