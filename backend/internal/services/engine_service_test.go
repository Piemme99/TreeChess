package services

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository/mocks"
)

func TestRunWorker_ResetsStaleProcessingOnStartup(t *testing.T) {
	resetCalled := false
	mockEvalRepo := &mocks.MockEngineEvalRepo{
		ResetStaleProcessingFunc: func() (int, error) {
			resetCalled = true
			return 3, nil
		},
	}
	mockAnalysisRepo := &mocks.MockAnalysisRepo{}

	svc := NewEngineService(mockEvalRepo, mockAnalysisRepo)

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	svc.RunWorker(ctx)

	assert.True(t, resetCalled, "ResetStaleProcessing should be called on worker startup")
}

func TestRunWorker_ResetsStaleProcessingErrorDoesNotPreventWorker(t *testing.T) {
	resetCalled := false
	pendingCalled := false

	mockEvalRepo := &mocks.MockEngineEvalRepo{
		ResetStaleProcessingFunc: func() (int, error) {
			resetCalled = true
			return 0, errors.New("db connection failed")
		},
		GetPendingFunc: func(limit int) ([]models.EngineEval, error) {
			pendingCalled = true
			return nil, nil
		},
	}
	mockAnalysisRepo := &mocks.MockAnalysisRepo{}

	svc := NewEngineService(mockEvalRepo, mockAnalysisRepo)

	// Give enough time for at least one poll cycle after the reset error
	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
	defer cancel()

	svc.RunWorker(ctx)

	assert.True(t, resetCalled, "ResetStaleProcessing should be called even if it errors")
	assert.True(t, pendingCalled, "Worker should continue processing after reset error")
}

func TestGetInsightsData_ProcessingCountsAsIncomplete(t *testing.T) {
	mockEvalRepo := &mocks.MockEngineEvalRepo{
		GetByUserFunc: func(userID string) ([]models.EngineEval, error) {
			return []models.EngineEval{
				{ID: "1", Status: "done"},
				{ID: "2", Status: "done"},
				{ID: "3", Status: "processing"}, // stuck
			}, nil
		},
	}
	mockAnalysisRepo := &mocks.MockAnalysisRepo{}

	svc := NewEngineService(mockEvalRepo, mockAnalysisRepo)
	data, err := svc.GetInsightsData("user-1")

	assert.NoError(t, err)
	assert.Equal(t, 3, data.Total)
	assert.Equal(t, 2, data.Completed)
	assert.False(t, data.AllDone, "AllDone should be false when processing evals exist")
}

func TestGetInsightsData_AllDoneWhenAllCompleted(t *testing.T) {
	mockEvalRepo := &mocks.MockEngineEvalRepo{
		GetByUserFunc: func(userID string) ([]models.EngineEval, error) {
			return []models.EngineEval{
				{ID: "1", Status: "done"},
				{ID: "2", Status: "failed"},
				{ID: "3", Status: "done"},
			}, nil
		},
	}
	mockAnalysisRepo := &mocks.MockAnalysisRepo{}

	svc := NewEngineService(mockEvalRepo, mockAnalysisRepo)
	data, err := svc.GetInsightsData("user-1")

	assert.NoError(t, err)
	assert.Equal(t, 3, data.Total)
	assert.Equal(t, 3, data.Completed)
	assert.True(t, data.AllDone)
}
