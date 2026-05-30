package services

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository/mocks"
)

// stubExplorerCache is an in-memory implementation of the cache repo used by
// EngineService tests.
type stubExplorerCache struct {
	store map[string][]byte
}

func newStubExplorerCache() *stubExplorerCache {
	return &stubExplorerCache{store: map[string][]byte{}}
}

func (c *stubExplorerCache) Get(_ context.Context, key string) ([]byte, bool, error) {
	v, ok := c.store[key]
	return v, ok, nil
}

func (c *stubExplorerCache) Put(_ context.Context, key string, payload []byte, _ time.Time) error {
	c.store[key] = payload
	return nil
}

func (c *stubExplorerCache) DeleteExpired(_ context.Context) error {
	return nil
}

func TestRunWorker_ResetsStaleProcessingOnStartup(t *testing.T) {
	resetCalled := false
	mockEvalRepo := &mocks.MockEngineEvalRepo{
		ResetStaleProcessingFunc: func(_ context.Context) (int, error) {
			resetCalled = true
			return 3, nil
		},
	}
	mockAnalysisRepo := &mocks.MockAnalysisRepo{}

	svc := NewEngineService(mockEvalRepo, mockAnalysisRepo, newStubExplorerCache())

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	svc.RunWorker(ctx)

	assert.True(t, resetCalled, "ResetStaleProcessing should be called on worker startup")
}

func TestRunWorker_ResetsStaleProcessingErrorDoesNotPreventWorker(t *testing.T) {
	resetCalled := false
	pendingCalled := false

	mockEvalRepo := &mocks.MockEngineEvalRepo{
		ResetStaleProcessingFunc: func(_ context.Context) (int, error) {
			resetCalled = true
			return 0, errors.New("db connection failed")
		},
		GetPendingFunc: func(_ context.Context, limit int) ([]models.EngineEval, error) {
			pendingCalled = true
			return nil, nil
		},
	}
	mockAnalysisRepo := &mocks.MockAnalysisRepo{}

	svc := NewEngineService(mockEvalRepo, mockAnalysisRepo, newStubExplorerCache())

	// Give enough time for at least one poll cycle after the reset error
	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
	defer cancel()

	svc.RunWorker(ctx)

	assert.True(t, resetCalled, "ResetStaleProcessing should be called even if it errors")
	assert.True(t, pendingCalled, "Worker should continue processing after reset error")
}

func TestGetInsightsData_ProcessingCountsAsIncomplete(t *testing.T) {
	mockEvalRepo := &mocks.MockEngineEvalRepo{
		GetByUserFunc: func(_ context.Context, userID string) ([]models.EngineEval, error) {
			return []models.EngineEval{
				{ID: "1", Status: "done"},
				{ID: "2", Status: "done"},
				{ID: "3", Status: "processing"}, // stuck
			}, nil
		},
	}
	mockAnalysisRepo := &mocks.MockAnalysisRepo{}

	svc := NewEngineService(mockEvalRepo, mockAnalysisRepo, newStubExplorerCache())
	data, err := svc.GetInsightsData(context.Background(), "user-1")

	assert.NoError(t, err)
	assert.Equal(t, 3, data.Total)
	assert.Equal(t, 2, data.Completed)
	assert.False(t, data.AllDone, "AllDone should be false when processing evals exist")
}

func TestGetInsightsData_AllDoneWhenAllCompleted(t *testing.T) {
	mockEvalRepo := &mocks.MockEngineEvalRepo{
		GetByUserFunc: func(_ context.Context, userID string) ([]models.EngineEval, error) {
			return []models.EngineEval{
				{ID: "1", Status: "done"},
				{ID: "2", Status: "failed"},
				{ID: "3", Status: "done"},
			}, nil
		},
	}
	mockAnalysisRepo := &mocks.MockAnalysisRepo{}

	svc := NewEngineService(mockEvalRepo, mockAnalysisRepo, newStubExplorerCache())
	data, err := svc.GetInsightsData(context.Background(), "user-1")

	assert.NoError(t, err)
	assert.Equal(t, 3, data.Total)
	assert.Equal(t, 3, data.Completed)
	assert.True(t, data.AllDone)
}

func TestEngineService_FetchExplorer_CacheHitReturnsStats(t *testing.T) {
	cache := newStubExplorerCache()
	cache.store[CanonicalKey(DefaultOpeningQuery("starting-fen"))] = []byte(`{"white":7,"draws":3,"black":1,"moves":[{"uci":"e2e4","san":"e4","white":4,"draws":2,"black":1,"averageRating":1900}]}`)

	svc := NewEngineService(&mocks.MockEngineEvalRepo{}, &mocks.MockAnalysisRepo{}, cache)

	resp, err := svc.fetchExplorer(context.Background(), "starting-fen")
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, 7, resp.White)
	assert.Equal(t, 3, resp.Draws)
	assert.Equal(t, 1, resp.Black)
	require.Len(t, resp.Moves, 1)
	assert.Equal(t, "e4", resp.Moves[0].SAN)
}

func TestEngineService_FetchExplorer_CacheMissReturnsNilNoError(t *testing.T) {
	svc := NewEngineService(&mocks.MockEngineEvalRepo{}, &mocks.MockAnalysisRepo{}, newStubExplorerCache())

	resp, err := svc.fetchExplorer(context.Background(), "missing-fen")
	require.NoError(t, err)
	assert.Nil(t, resp, "cache miss must surface as nil result so callers can skip the position without HTTP")
}
