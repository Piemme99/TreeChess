package services

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/repository/mocks"
)

// rootID used by the helper trees below.
const optLockRootID = "00000000-0000-0000-0000-000000000001"

// repAtVersion returns a single-node repertoire loaded at the given version.
func repAtVersion(id string, version int) *models.Repertoire {
	return &models.Repertoire{
		ID:       id,
		Name:     "Lock Test",
		Color:    models.ColorWhite,
		Version:  version,
		TreeData: makeTree(optLockRootID),
	}
}

// TestAddNode_ThreadsLoadedVersionToSave asserts that the version loaded by
// GetByID is forwarded as the expected version on Save, which is what lets the
// conditional UPDATE reject stale writes.
func TestAddNode_ThreadsLoadedVersionToSave(t *testing.T) {
	const loadedVersion = 7
	var savedExpectedVersion int

	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(id string) (*models.Repertoire, error) {
			return repAtVersion(id, loadedVersion), nil
		},
		SaveFunc: func(id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			savedExpectedVersion = expectedVersion
			return &models.Repertoire{ID: id, TreeData: treeData, Metadata: metadata, Version: expectedVersion + 1}, nil
		},
	}

	svc := NewRepertoireService(mockRepo)
	_, err := svc.AddNode("user-1", "rep-1", models.AddNodeRequest{ParentID: optLockRootID, Move: "e4"})
	require.NoError(t, err)
	assert.Equal(t, loadedVersion, savedExpectedVersion, "Save must receive the version loaded by GetByID")
}

// TestAddNode_ConflictMapsToErrConflict asserts that an optimistic-lock failure
// from the repository surfaces as the service-level ErrConflict sentinel.
func TestAddNode_ConflictMapsToErrConflict(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(id string) (*models.Repertoire, error) {
			return repAtVersion(id, 1), nil
		},
		SaveFunc: func(id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			return nil, repository.ErrRepertoireConflict
		},
	}

	svc := NewRepertoireService(mockRepo)
	_, err := svc.AddNode("user-1", "rep-1", models.AddNodeRequest{ParentID: optLockRootID, Move: "e4"})
	assert.ErrorIs(t, err, ErrConflict)
}

// TestNodeMutators_ConflictMapsToErrConflict covers the remaining tree mutators
// that share the load-mutate-save shape, ensuring each maps a repository
// conflict to ErrConflict rather than leaking the raw repository error.
func TestNodeMutators_ConflictMapsToErrConflict(t *testing.T) {
	childID := "00000000-0000-0000-0000-0000000000c1"

	newRepo := func() *mocks.MockRepertoireRepo {
		return &mocks.MockRepertoireRepo{
			GetByIDFunc: func(id string) (*models.Repertoire, error) {
				rep := repAtVersion(id, 3)
				rep.TreeData = makeTree(optLockRootID, makeChild(childID, "e4"))
				return rep, nil
			},
			SaveFunc: func(id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
				return nil, repository.ErrRepertoireConflict
			},
		}
	}

	cases := map[string]func(svc *RepertoireService) error{
		"DeleteNode": func(svc *RepertoireService) error {
			_, err := svc.DeleteNode("user-1", "rep-1", childID)
			return err
		},
		"SaveTree": func(svc *RepertoireService) error {
			_, err := svc.SaveTree("user-1", "rep-1", makeTree(optLockRootID))
			return err
		},
		"UpdateNodeComment": func(svc *RepertoireService) error {
			_, err := svc.UpdateNodeComment("user-1", "rep-1", childID, "hi")
			return err
		},
		"UpdateNodeBranchName": func(svc *RepertoireService) error {
			_, err := svc.UpdateNodeBranchName("user-1", "rep-1", childID, "Mainline")
			return err
		},
		"ToggleNodeCollapsed": func(svc *RepertoireService) error {
			_, err := svc.ToggleNodeCollapsed("user-1", "rep-1", childID)
			return err
		},
		"SetMainLine": func(svc *RepertoireService) error {
			_, err := svc.SetMainLine("user-1", "rep-1", childID)
			return err
		},
		"ClearMainLine": func(svc *RepertoireService) error {
			_, err := svc.ClearMainLine("user-1", "rep-1")
			return err
		},
		"MergeTranspositions": func(svc *RepertoireService) error {
			_, err := svc.MergeTranspositions("user-1", "rep-1")
			return err
		},
	}

	for name, run := range cases {
		t.Run(name, func(t *testing.T) {
			svc := NewRepertoireService(newRepo())
			err := run(svc)
			assert.ErrorIs(t, err, ErrConflict, "%s should map a repository conflict to ErrConflict", name)
		})
	}
}

// TestSave_NotFoundMapsToErrNotFound asserts that a vanished repertoire (the
// other no-rows cause) maps to ErrNotFound rather than ErrConflict.
func TestSave_NotFoundMapsToErrNotFound(t *testing.T) {
	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(id string) (*models.Repertoire, error) {
			return repAtVersion(id, 0), nil
		},
		SaveFunc: func(id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			return nil, repository.ErrRepertoireNotFound
		},
	}

	svc := NewRepertoireService(mockRepo)
	_, err := svc.AddNode("user-1", "rep-1", models.AddNodeRequest{ParentID: optLockRootID, Move: "e4"})
	assert.ErrorIs(t, err, ErrNotFound)
	assert.NotErrorIs(t, err, ErrConflict)
}
