package services

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/repository/mocks"
	smocks "github.com/kumquat/backend/internal/services/mocks"
)

// errInjected is a sentinel used to inject mid-transaction failures.
var errInjected = fmt.Errorf("injected failure")

// --- MergeRepertoires rollback ---

// TestMergeRepertoires_RollsBackOnDeleteFailure verifies that when one of the
// per-source deletes fails mid-merge, the whole operation is wrapped in a single
// transaction (so the merged repertoire and any earlier deletes roll back) and
// no re-analysis is triggered.
func TestMergeRepertoires_RollsBackOnDeleteFailure(t *testing.T) {
	e4 := "e4"
	d4 := "d4"
	reps := map[string]*models.Repertoire{
		"rep-1": {ID: "rep-1", Color: models.ColorWhite, TreeData: makeTree("r1", makeChild("c1", e4))},
		"rep-2": {ID: "rep-2", Color: models.ColorWhite, TreeData: makeTree("r2", makeChild("c2", d4))},
	}

	var withinTxCalls, deleteAttempts int
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string, _ string) (*models.Repertoire, error) {
			if r, ok := reps[id]; ok {
				return r, nil
			}
			return nil, repository.ErrRepertoireNotFound
		},
		CreateFunc: func(_ context.Context, userID, name string, color models.Color) (*models.Repertoire, error) {
			return &models.Repertoire{ID: "merged", Name: name, Color: color, TreeData: makeTree("new-root")}, nil
		},
		SaveFunc: func(_ context.Context, id, userID string, treeData models.RepertoireNode, metadata models.Metadata, _ int) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, TreeData: treeData, Metadata: metadata}, nil
		},
		DeleteFunc: func(_ context.Context, id, userID string) error {
			deleteAttempts++
			// First delete succeeds; the second fails mid-loop.
			if deleteAttempts >= 2 {
				return errInjected
			}
			return nil
		},
	}
	// Count how many times the flow opened a transaction, while still running the
	// closure so the injected delete failure surfaces.
	mockRepo.WithinTxFunc = func(ctx context.Context, fn func(tx repository.RepertoireTx) error) error {
		withinTxCalls++
		return defaultWithinTx(mockRepo, fn)
	}

	notifier := &fakeNotifier{}
	svc := NewRepertoireService(mockRepo).WithReanalysisQueue(notifier)

	_, err := svc.MergeRepertoires(context.Background(), "user-1", []string{"rep-1", "rep-2"}, "Merged")

	require.Error(t, err)
	assert.ErrorIs(t, err, errInjected)
	assert.Equal(t, 1, withinTxCalls, "merge must run inside exactly one transaction")
	assert.Equal(t, 0, notifier.Count(), "no re-analysis should fire when the transaction fails")
}

// TestMergeRepertoires_RollsBackOnCommitFailure verifies that a failed commit
// (modeled via WithinTxFunc returning an error) is surfaced and suppresses the
// re-analysis notification.
func TestMergeRepertoires_RollsBackOnCommitFailure(t *testing.T) {
	reps := map[string]*models.Repertoire{
		"rep-1": {ID: "rep-1", Color: models.ColorWhite, TreeData: makeTree("r1")},
		"rep-2": {ID: "rep-2", Color: models.ColorWhite, TreeData: makeTree("r2")},
	}
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string, _ string) (*models.Repertoire, error) {
			if r, ok := reps[id]; ok {
				return r, nil
			}
			return nil, repository.ErrRepertoireNotFound
		},
		WithinTxFunc: func(ctx context.Context, fn func(tx repository.RepertoireTx) error) error {
			// Simulate the commit itself failing after the closure succeeds.
			return fmt.Errorf("failed to commit transaction: %w", errInjected)
		},
	}

	notifier := &fakeNotifier{}
	svc := NewRepertoireService(mockRepo).WithReanalysisQueue(notifier)

	_, err := svc.MergeRepertoires(context.Background(), "user-1", []string{"rep-1", "rep-2"}, "Merged")

	require.Error(t, err)
	assert.ErrorIs(t, err, errInjected)
	assert.Equal(t, 0, notifier.Count())
}

// --- ExtractSubtree rollback ---

// TestExtractSubtree_RollsBackOnPruneSaveFailure verifies that if saving the
// pruned original fails after the extracted repertoire was created/saved, the
// whole flow runs in one transaction (which rolls back) and no re-analysis runs.
func TestExtractSubtree_RollsBackOnPruneSaveFailure(t *testing.T) {
	move1 := "e4"
	move2 := "e5"
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string, _ string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:    id,
				Name:  "Original",
				Color: models.ColorWhite,
				TreeData: models.RepertoireNode{
					ID:  "root",
					FEN: "start",
					Children: []*models.RepertoireNode{
						{ID: "child1", Move: &move1, FEN: "after-e4", Children: []*models.RepertoireNode{
							{ID: "grandchild", Move: &move2, FEN: "after-e5", Children: []*models.RepertoireNode{}},
						}},
					},
				},
			}, nil
		},
		CountFunc: func(_ context.Context, userID string) (int, error) { return 1, nil },
		CreateFunc: func(_ context.Context, userID, name string, color models.Color) (*models.Repertoire, error) {
			return &models.Repertoire{ID: "new-rep", Name: name, Color: color}, nil
		},
	}
	var saveCalls int
	mockRepo.SaveFunc = func(_ context.Context, id, userID string, treeData models.RepertoireNode, metadata models.Metadata, _ int) (*models.Repertoire, error) {
		saveCalls++
		// First save (extracted copy) succeeds; second save (pruned original) fails.
		if saveCalls >= 2 {
			return nil, errInjected
		}
		return &models.Repertoire{ID: id, TreeData: treeData, Metadata: metadata}, nil
	}
	var withinTxCalls int
	mockRepo.WithinTxFunc = func(ctx context.Context, fn func(tx repository.RepertoireTx) error) error {
		withinTxCalls++
		return defaultWithinTx(mockRepo, fn)
	}

	notifier := &fakeNotifier{}
	svc := NewRepertoireService(mockRepo).WithReanalysisQueue(notifier)

	_, err := svc.ExtractSubtree(context.Background(), "user-1", "rep-1", "child1", "Extracted")

	require.Error(t, err)
	assert.ErrorIs(t, err, errInjected)
	assert.Equal(t, 1, withinTxCalls, "extract must run inside exactly one transaction")
	assert.Equal(t, 0, notifier.Count(), "no re-analysis should fire when the transaction fails")
}

// --- Study import rollback ---

// TestImportStudyChaptersWithCategory_RollsBackOnFailure verifies that a failure
// while persisting the study (modeled by PersistStudyImportFunc) is surfaced as
// an error and leaves nothing partial — the service never returns a partial
// result.
func TestImportStudyChaptersWithCategory_RollsBackOnFailure(t *testing.T) {
	pgnData := `[Event "Study: Sicilian"]
[Orientation "White"]

1. e4 c5 *

[Event "Study: French"]
[Orientation "White"]

1. e4 e6 *
`
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) { return pgnData, nil },
	}

	var planSeen models.StudyImportPlan
	var persistCalls int
	mockRepSvc := &smocks.MockRepertoireService{
		ListRepertoiresFunc: func(_ context.Context, userID string, color *models.Color) ([]models.Repertoire, error) {
			return nil, nil
		},
		PersistStudyImportFunc: func(_ context.Context, userID string, plan models.StudyImportPlan) (*models.StudyImportPersistResult, error) {
			persistCalls++
			planSeen = plan
			// Simulate the import transaction failing (e.g. category created but a
			// later repertoire insert errors) — the whole unit-of-work rolls back.
			return nil, fmt.Errorf("failed to create repertoire %q: %w", "French", errInjected)
		},
	}

	svc := NewStudyImportService(mockLichess, mockRepSvc, &mocks.MockUserRepo{})

	result, err := svc.ImportStudyChaptersWithCategory(context.Background(), "user-1", "testid01", "", []int{0, 1}, true, "Sicilian", false, true, RenameStrategyAbort)

	require.Error(t, err)
	assert.Nil(t, result, "no partial result on a failed atomic import")
	assert.ErrorIs(t, err, errInjected)
	assert.Equal(t, 1, persistCalls, "persistence must happen in a single atomic call")
	// The plan handed to the unit-of-work bundles the category and both chapters,
	// so the category and repertoires are created/rolled back together.
	require.NotNil(t, planSeen.Category)
	assert.Equal(t, "Sicilian", planSeen.Category.Name)
	assert.Len(t, planSeen.Repertoires, 2)
}

// TestImportStudyChaptersMerged_RollsBackOnFailure verifies the merged import
// path also persists atomically and surfaces failures without partial state.
func TestImportStudyChaptersMerged_RollsBackOnFailure(t *testing.T) {
	pgnData := `[Event "Study: Sicilian"]
[Orientation "White"]

1. e4 c5 *

[Event "Study: French"]
[Orientation "White"]

1. e4 e6 *
`
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) { return pgnData, nil },
	}
	var persistCalls int
	mockRepSvc := &smocks.MockRepertoireService{
		ListRepertoiresFunc: func(_ context.Context, userID string, color *models.Color) ([]models.Repertoire, error) {
			return nil, nil
		},
		PersistStudyImportFunc: func(_ context.Context, userID string, plan models.StudyImportPlan) (*models.StudyImportPersistResult, error) {
			persistCalls++
			assert.Nil(t, plan.Category, "merged import creates no category")
			require.Len(t, plan.Repertoires, 1)
			return nil, fmt.Errorf("failed to save repertoire %q: %w", plan.Repertoires[0].Name, errInjected)
		},
	}

	svc := NewStudyImportService(mockLichess, mockRepSvc, &mocks.MockUserRepo{})

	result, err := svc.ImportStudyChaptersMerged(context.Background(), "user-1", "testid01", "", []int{0, 1}, "Merged", false, true, RenameStrategyAbort)

	require.Error(t, err)
	assert.Nil(t, result)
	assert.ErrorIs(t, err, errInjected)
	assert.Equal(t, 1, persistCalls)
}

// --- PersistStudyImport (RepertoireService) rollback wiring ---

// TestPersistStudyImport_RollsBackAndSkipsNotify verifies the real
// RepertoireService.PersistStudyImport runs everything inside one WithinTx and
// does not notify re-analysis when the transaction fails.
func TestPersistStudyImport_RollsBackAndSkipsNotify(t *testing.T) {
	tree := makeTree("root")
	var createCount, withinTxCalls int
	mockRepo := &mocks.MockRepertoireRepo{
		CreateCategoryFunc: func(_ context.Context, userID, name string, color models.Color) (*models.Category, error) {
			return &models.Category{ID: "cat-1", Name: name, Color: color}, nil
		},
		CreateFunc: func(_ context.Context, userID, name string, color models.Color) (*models.Repertoire, error) {
			createCount++
			// Second repertoire creation fails, rolling back the category and the
			// first repertoire.
			if createCount >= 2 {
				return nil, errInjected
			}
			return &models.Repertoire{ID: fmt.Sprintf("rep-%d", createCount), Name: name, Color: color}, nil
		},
		CreateWithCategoryFunc: func(_ context.Context, userID, name string, color models.Color, categoryID *string) (*models.Repertoire, error) {
			createCount++
			if createCount >= 2 {
				return nil, errInjected
			}
			return &models.Repertoire{ID: fmt.Sprintf("rep-%d", createCount), Name: name, Color: color, CategoryID: categoryID}, nil
		},
		SaveFunc: func(_ context.Context, id, userID string, treeData models.RepertoireNode, metadata models.Metadata, _ int) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, TreeData: treeData, Metadata: metadata}, nil
		},
	}
	mockRepo.WithinTxFunc = func(ctx context.Context, fn func(tx repository.RepertoireTx) error) error {
		withinTxCalls++
		return defaultWithinTx(mockRepo, fn)
	}

	notifier := &fakeNotifier{}
	svc := NewRepertoireService(mockRepo).WithReanalysisQueue(notifier)

	white := models.ColorWhite
	_, err := svc.PersistStudyImport(context.Background(), "user-1", models.StudyImportPlan{
		Category: &models.StudyImportCategorySpec{Name: "Cat", Color: white},
		Repertoires: []models.StudyImportRepertoireSpec{
			{Name: "A", Color: white, UseCategory: true, Tree: tree},
			{Name: "B", Color: white, UseCategory: true, Tree: tree},
		},
	})

	require.Error(t, err)
	assert.ErrorIs(t, err, errInjected)
	assert.Equal(t, 1, withinTxCalls, "study import must persist in exactly one transaction")
	assert.Equal(t, 0, notifier.Count(), "no re-analysis should fire when the transaction fails")
}

// defaultWithinTx mirrors the production WithinTx contract against the mock: it
// runs the closure with a transaction-bound view of the mock and returns the
// closure's error verbatim (nil = committed). It lets tests wrap WithinTxFunc
// with a counter while still exercising the closure's mutations.
func defaultWithinTx(repo *mocks.MockRepertoireRepo, fn func(tx repository.RepertoireTx) error) error {
	prev := repo.WithinTxFunc
	repo.WithinTxFunc = nil
	defer func() { repo.WithinTxFunc = prev }()
	return repo.WithinTx(context.Background(), fn)
}
