package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/repository/mocks"
	"github.com/kumquat/backend/internal/services"
)

const (
	optLockRepUUID  = "123e4567-e89b-12d3-a456-426614174000"
	optLockNodeUUID = "223e4567-e89b-12d3-a456-426614174000"
)

// repWithNodeAtVersion builds a repertoire (root + one child node) at a given
// optimistic-lock version, used to back the GetByID mock.
func repWithNodeAtVersion(id string, version int) *models.Repertoire {
	return &models.Repertoire{
		ID:      id,
		Version: version,
		TreeData: models.RepertoireNode{
			ID:  "root",
			FEN: "start",
			Children: []*models.RepertoireNode{
				{ID: optLockNodeUUID, FEN: "fen1", Children: []*models.RepertoireNode{}},
			},
		},
	}
}

func newCommentRequest(t *testing.T, ifMatch string) (*echo.Context, *httptest.ResponseRecorder) {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodPatch, "/api/repertoires/"+optLockRepUUID+"/nodes/"+optLockNodeUUID+"/comment", strings.NewReader(`{"comment":"hi"}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	if ifMatch != "" {
		req.Header.Set("If-Match", ifMatch)
	}
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetPathValues(echo.PathValues{{Name: "id", Value: optLockRepUUID}, {Name: "nodeId", Value: optLockNodeUUID}})
	setTestUserID(c)
	return c, rec
}

// TestGetRepertoireHandler_SetsETag verifies the read path exposes the version
// via the ETag header so clients can echo it back on the next mutation.
func TestGetRepertoireHandler_SetsETag(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/repertoires/"+optLockRepUUID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetPathValues(echo.PathValues{{Name: "id", Value: optLockRepUUID}})
	setTestUserID(c)

	mockRepo := &mocks.MockRepertoireRepo{
		BelongsToUserFunc: func(_ context.Context, id, userID string) (bool, error) { return true, nil },
		GetByIDFunc: func(_ context.Context, id string, _ string) (*models.Repertoire, error) {
			return repWithNodeAtVersion(id, 5), nil
		},
	}
	svc := services.NewRepertoireService(mockRepo)
	require.NoError(t, GetRepertoireHandler(svc)(c))
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "5", rec.Header().Get("ETag"))
}

// TestMutation_NoIfMatch_Succeeds confirms the precondition is optional:
// without an If-Match header the mutation proceeds and stamps the new ETag.
func TestMutation_NoIfMatch_Succeeds(t *testing.T) {
	c, rec := newCommentRequest(t, "")
	mockRepo := &mocks.MockRepertoireRepo{
		BelongsToUserFunc: func(_ context.Context, id, userID string) (bool, error) { return true, nil },
		GetByIDFunc: func(_ context.Context, id string, _ string) (*models.Repertoire, error) {
			return repWithNodeAtVersion(id, 2), nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, TreeData: treeData, Metadata: metadata, Version: expectedVersion + 1}, nil
		},
	}
	svc := services.NewRepertoireService(mockRepo)
	require.NoError(t, UpdateNodeCommentHandler(svc)(c))
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "3", rec.Header().Get("ETag"), "response should carry the bumped version")
}

// TestMutation_MatchingIfMatch_Succeeds confirms a current client version
// passes the precondition.
func TestMutation_MatchingIfMatch_Succeeds(t *testing.T) {
	c, rec := newCommentRequest(t, "2")
	mockRepo := &mocks.MockRepertoireRepo{
		BelongsToUserFunc: func(_ context.Context, id, userID string) (bool, error) { return true, nil },
		GetByIDFunc: func(_ context.Context, id string, _ string) (*models.Repertoire, error) {
			return repWithNodeAtVersion(id, 2), nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			return &models.Repertoire{ID: id, TreeData: treeData, Metadata: metadata, Version: expectedVersion + 1}, nil
		},
	}
	svc := services.NewRepertoireService(mockRepo)
	require.NoError(t, UpdateNodeCommentHandler(svc)(c))
	assert.Equal(t, http.StatusOK, rec.Code)
}

// TestMutation_StaleIfMatch_Returns409 is the core acceptance scenario: a
// client holding an older version is rejected with 409 instead of silently
// overwriting a newer write, and is told the current version via ETag.
func TestMutation_StaleIfMatch_Returns409(t *testing.T) {
	c, rec := newCommentRequest(t, "1")
	saveCalled := false
	mockRepo := &mocks.MockRepertoireRepo{
		BelongsToUserFunc: func(_ context.Context, id, userID string) (bool, error) { return true, nil },
		GetByIDFunc: func(_ context.Context, id string, _ string) (*models.Repertoire, error) {
			return repWithNodeAtVersion(id, 4), nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			saveCalled = true
			return nil, nil
		},
	}
	svc := services.NewRepertoireService(mockRepo)
	require.NoError(t, UpdateNodeCommentHandler(svc)(c))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.Equal(t, "4", rec.Header().Get("ETag"), "409 should advertise the current version")
	assert.False(t, saveCalled, "stale precondition must short-circuit before saving")
}

// TestMutation_MalformedIfMatch_Returns400 rejects a non-numeric precondition.
func TestMutation_MalformedIfMatch_Returns400(t *testing.T) {
	c, rec := newCommentRequest(t, "not-a-number")
	mockRepo := &mocks.MockRepertoireRepo{
		BelongsToUserFunc: func(_ context.Context, id, userID string) (bool, error) { return true, nil },
		GetByIDFunc: func(_ context.Context, id string, _ string) (*models.Repertoire, error) {
			return repWithNodeAtVersion(id, 1), nil
		},
	}
	svc := services.NewRepertoireService(mockRepo)
	require.NoError(t, UpdateNodeCommentHandler(svc)(c))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

// TestMutation_RepoConflict_Returns409 covers the server-side race: the
// precondition passes but the conditional UPDATE loses (repository returns a
// conflict), which the handler maps to 409.
func TestMutation_RepoConflict_Returns409(t *testing.T) {
	c, rec := newCommentRequest(t, "2")
	mockRepo := &mocks.MockRepertoireRepo{
		BelongsToUserFunc: func(_ context.Context, id, userID string) (bool, error) { return true, nil },
		GetByIDFunc: func(_ context.Context, id string, _ string) (*models.Repertoire, error) {
			return repWithNodeAtVersion(id, 2), nil
		},
		SaveFunc: func(_ context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
			return nil, repository.ErrRepertoireConflict
		},
	}
	svc := services.NewRepertoireService(mockRepo)
	require.NoError(t, UpdateNodeCommentHandler(svc)(c))
	assert.Equal(t, http.StatusConflict, rec.Code)
}
