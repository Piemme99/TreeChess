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
	claimCalled := false

	mockEvalRepo := &mocks.MockEngineEvalRepo{
		ResetStaleProcessingFunc: func(_ context.Context) (int, error) {
			resetCalled = true
			return 0, errors.New("db connection failed")
		},
		ClaimPendingFunc: func(_ context.Context, limit int) ([]models.EngineEval, error) {
			claimCalled = true
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
	assert.True(t, claimCalled, "Worker should continue claiming after reset error")
}

func TestSafeProcessPending_PanicDoesNotKillWorker(t *testing.T) {
	calls := 0
	mockEvalRepo := &mocks.MockEngineEvalRepo{
		ClaimPendingFunc: func(_ context.Context, limit int) ([]models.EngineEval, error) {
			calls++
			if calls == 1 {
				panic("boom: simulated eval failure")
			}
			return nil, nil
		},
	}
	svc := NewEngineService(mockEvalRepo, &mocks.MockAnalysisRepo{}, newStubExplorerCache())

	// The first pass panics; safeProcessPending must recover so the worker can
	// run further passes (acceptance criterion: a panic in one eval does not
	// kill the worker loop).
	assert.NotPanics(t, func() { svc.safeProcessPending(context.Background()) }, "panic in a pass must be recovered")
	assert.NotPanics(t, func() { svc.safeProcessPending(context.Background()) }, "subsequent passes must still run")
	assert.Equal(t, 2, calls, "worker should keep claiming after a panicking pass")
}

func TestProcessPending_ClaimsAndSaves(t *testing.T) {
	claimedOnce := false
	var savedID string
	mockEvalRepo := &mocks.MockEngineEvalRepo{
		ClaimPendingFunc: func(_ context.Context, limit int) ([]models.EngineEval, error) {
			if claimedOnce {
				return nil, nil
			}
			claimedOnce = true
			return []models.EngineEval{{ID: "eval-1", AnalysisID: "analysis-1", GameIndex: 0}}, nil
		},
		SaveEvalsFunc: func(_ context.Context, id string, _ []models.ExplorerMoveStats) error {
			savedID = id
			return nil
		},
	}
	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.AnalysisDetail, error) {
			return &models.AnalysisDetail{
				Results: []models.GameAnalysis{{GameIndex: 0, UserColor: models.ColorWhite}},
			}, nil
		},
	}
	svc := NewEngineService(mockEvalRepo, mockAnalysisRepo, newStubExplorerCache())

	svc.processPending(context.Background())

	assert.Equal(t, "eval-1", savedID, "claimed eval should be saved via SaveEvals")
}

func TestProcessPending_AnalyzeErrorMarksFailed(t *testing.T) {
	var failedID string
	mockEvalRepo := &mocks.MockEngineEvalRepo{
		ClaimPendingFunc: func(_ context.Context, limit int) ([]models.EngineEval, error) {
			return []models.EngineEval{{ID: "eval-1", AnalysisID: "analysis-1", GameIndex: 0}}, nil
		},
		MarkFailedFunc: func(_ context.Context, id string) error {
			failedID = id
			return nil
		},
	}
	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.AnalysisDetail, error) {
			return nil, errors.New("analysis not found")
		},
	}
	svc := NewEngineService(mockEvalRepo, mockAnalysisRepo, newStubExplorerCache())

	svc.processPending(context.Background())

	assert.Equal(t, "eval-1", failedID, "an eval that fails to analyze should be marked failed")
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
