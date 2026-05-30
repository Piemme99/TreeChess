package services

import (
	"context"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository/mocks"
)

// fakeNotifier records every Notify(userID) call so tests can assert that
// repertoire mutations correctly trigger a re-analysis trigger.
type fakeNotifier struct {
	mu   sync.Mutex
	hits []string
}

func (f *fakeNotifier) Notify(userID string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.hits = append(f.hits, userID)
}

func (f *fakeNotifier) Count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.hits)
}

func newRepoWithEmptyTree(rootID string) *mocks.MockRepertoireRepo {
	return &mocks.MockRepertoireRepo{
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
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:       id,
				TreeData: treeData,
				Metadata: metadata,
			}, nil
		},
		DeleteFunc: func(_ context.Context, id, userID string) error {
			return nil
		},
	}
}

func TestRepertoireService_AddNode_NotifiesQueue(t *testing.T) {
	rootID := "root-uuid"
	notifier := &fakeNotifier{}
	svc := NewRepertoireService(newRepoWithEmptyTree(rootID)).WithReanalysisQueue(notifier)

	_, err := svc.AddNode(context.Background(), "user-1", "rep-1", models.AddNodeRequest{
		ParentID:   rootID,
		Move:       "e4",
		MoveNumber: 1,
	})
	require.NoError(t, err)
	assert.Equal(t, []string{"user-1"}, notifier.hits)
}

func TestRepertoireService_SaveTree_NotifiesQueue(t *testing.T) {
	notifier := &fakeNotifier{}
	repo := newRepoWithEmptyTree("root-uuid")
	svc := NewRepertoireService(repo).WithReanalysisQueue(notifier)

	tree := models.RepertoireNode{
		ID:  "root-uuid",
		FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
	}
	_, err := svc.SaveTree(context.Background(), "user-1", "rep-1", tree)
	require.NoError(t, err)
	assert.Equal(t, 1, notifier.Count())
}

func TestRepertoireService_DeleteNode_NotifiesQueue(t *testing.T) {
	move := "e4"
	notifier := &fakeNotifier{}
	repo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:    id,
				Color: models.ColorWhite,
				TreeData: models.RepertoireNode{
					ID: "root",
					Children: []*models.RepertoireNode{
						{ID: "child", Move: &move},
					},
				},
			}, nil
		},
		SaveFunc: func(_ context.Context, id, userID string, t models.RepertoireNode, m models.Metadata) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, TreeData: t, Metadata: m}, nil
		},
	}
	svc := NewRepertoireService(repo).WithReanalysisQueue(notifier)

	_, err := svc.DeleteNode(context.Background(), "user-1", "rep-1", "child")
	require.NoError(t, err)
	assert.Equal(t, 1, notifier.Count())
}

func TestRepertoireService_DeleteRepertoire_NotifiesQueue(t *testing.T) {
	notifier := &fakeNotifier{}
	repo := &mocks.MockRepertoireRepo{
		DeleteFunc: func(_ context.Context, id, userID string) error { return nil },
	}
	svc := NewRepertoireService(repo).WithReanalysisQueue(notifier)

	err := svc.DeleteRepertoire(context.Background(), "user-1", "rep-1")
	require.NoError(t, err)
	assert.Equal(t, 1, notifier.Count())
}

func TestRepertoireService_NoQueue_DoesNotPanic(t *testing.T) {
	rootID := "root-uuid"
	svc := NewRepertoireService(newRepoWithEmptyTree(rootID))
	// No queue attached — mutations must succeed without panicking.
	_, err := svc.AddNode(context.Background(), "user-1", "rep-1", models.AddNodeRequest{
		ParentID:   rootID,
		Move:       "e4",
		MoveNumber: 1,
	})
	require.NoError(t, err)
}

func TestRepertoireService_FailedMutation_DoesNotNotify(t *testing.T) {
	notifier := &fakeNotifier{}
	repo := &mocks.MockRepertoireRepo{
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
	svc := NewRepertoireService(repo).WithReanalysisQueue(notifier)

	// Invalid SAN — AddNode returns an error before Save is ever called.
	_, err := svc.AddNode(context.Background(), "user-1", "rep-1", models.AddNodeRequest{
		ParentID:   "root",
		Move:       "Zz9",
		MoveNumber: 1,
	})
	require.Error(t, err)
	assert.Equal(t, 0, notifier.Count(), "queue must not be notified when mutation fails")
}
