package mocks

import (
	"context"

	"github.com/kumquat/backend/internal/models"
)

// --- Email service mock ---

// MockEmailService implements services.EmailSender for testing
type MockEmailService struct {
	SendPasswordResetEmailFunc func(toEmail, token string) error
	EnabledFunc                func() bool
}

func (m *MockEmailService) SendPasswordResetEmail(toEmail, token string) error {
	if m.SendPasswordResetEmailFunc != nil {
		return m.SendPasswordResetEmailFunc(toEmail, token)
	}
	return nil
}

func (m *MockEmailService) Enabled() bool {
	if m.EnabledFunc != nil {
		return m.EnabledFunc()
	}
	return true
}

// --- External API service mocks ---

// MockLichessService implements services.LichessGameFetcher for testing
type MockLichessService struct {
	FetchGamesFunc           func(username string, options models.LichessImportOptions) (string, error)
	FetchStudyPGNFunc        func(studyID, authToken string) (string, error)
	FetchStudyMetadataFunc   func(studyID, authToken string) (*models.LichessStudyResult, error)
	SearchStudiesFunc        func(query, order string, page int, authToken string) (*models.LichessStudySearchResponse, error)
	BrowseStudiesByTopicFunc func(topic, sort string, page int, authToken string) (*models.LichessStudySearchResponse, error)
	BrowseAllStudiesFunc     func(sort string, page int, authToken string) (*models.LichessStudySearchResponse, error)
	GetPopularTopicsFunc     func() (*models.LichessTopicsResponse, error)
}

func (m *MockLichessService) FetchGames(username string, options models.LichessImportOptions) (string, error) {
	if m.FetchGamesFunc != nil {
		return m.FetchGamesFunc(username, options)
	}
	return "", nil
}

func (m *MockLichessService) FetchStudyPGN(studyID, authToken string) (string, error) {
	if m.FetchStudyPGNFunc != nil {
		return m.FetchStudyPGNFunc(studyID, authToken)
	}
	return "", nil
}

func (m *MockLichessService) FetchStudyMetadata(studyID, authToken string) (*models.LichessStudyResult, error) {
	if m.FetchStudyMetadataFunc != nil {
		return m.FetchStudyMetadataFunc(studyID, authToken)
	}
	return nil, nil
}

func (m *MockLichessService) SearchStudies(query, order string, page int, authToken string) (*models.LichessStudySearchResponse, error) {
	if m.SearchStudiesFunc != nil {
		return m.SearchStudiesFunc(query, order, page, authToken)
	}
	return nil, nil
}

func (m *MockLichessService) BrowseStudiesByTopic(topic, sort string, page int, authToken string) (*models.LichessStudySearchResponse, error) {
	if m.BrowseStudiesByTopicFunc != nil {
		return m.BrowseStudiesByTopicFunc(topic, sort, page, authToken)
	}
	return nil, nil
}

func (m *MockLichessService) BrowseAllStudies(sort string, page int, authToken string) (*models.LichessStudySearchResponse, error) {
	if m.BrowseAllStudiesFunc != nil {
		return m.BrowseAllStudiesFunc(sort, page, authToken)
	}
	return nil, nil
}

func (m *MockLichessService) GetPopularTopics() (*models.LichessTopicsResponse, error) {
	if m.GetPopularTopicsFunc != nil {
		return m.GetPopularTopicsFunc()
	}
	return nil, nil
}

// MockChesscomService implements services.ChesscomGameFetcher for testing
type MockChesscomService struct {
	FetchGamesFunc func(username string, options models.ChesscomImportOptions) (string, error)
}

func (m *MockChesscomService) FetchGames(username string, options models.ChesscomImportOptions) (string, error) {
	if m.FetchGamesFunc != nil {
		return m.FetchGamesFunc(username, options)
	}
	return "", nil
}

// --- Domain service mocks ---

// MockImportService implements services.GameImporter for testing
type MockImportService struct {
	ParseAndAnalyzeFunc func(ctx context.Context, filename, username, userID, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error)
}

func (m *MockImportService) ParseAndAnalyze(ctx context.Context, filename, username, userID, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error) {
	if m.ParseAndAnalyzeFunc != nil {
		return m.ParseAndAnalyzeFunc(ctx, filename, username, userID, pgnData)
	}
	return &models.AnalysisSummary{}, nil, nil
}

// MockRepertoireService implements services.RepertoireManager for testing
type MockRepertoireService struct {
	CreateRepertoireFunc             func(ctx context.Context, userID, name string, color models.Color) (*models.Repertoire, error)
	CreateRepertoireWithCategoryFunc func(ctx context.Context, userID, name string, color models.Color, categoryID *string) (*models.Repertoire, error)
	SaveTreeFunc                     func(ctx context.Context, userID, repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error)
	SetOriginFunc                    func(ctx context.Context, repertoireID string, origin *models.RepertoireOrigin) error
	ListRepertoiresFunc              func(ctx context.Context, userID string, color *models.Color) ([]models.Repertoire, error)
}

func (m *MockRepertoireService) CreateRepertoire(ctx context.Context, userID, name string, color models.Color) (*models.Repertoire, error) {
	if m.CreateRepertoireFunc != nil {
		return m.CreateRepertoireFunc(ctx, userID, name, color)
	}
	return nil, nil
}

func (m *MockRepertoireService) CreateRepertoireWithCategory(ctx context.Context, userID, name string, color models.Color, categoryID *string) (*models.Repertoire, error) {
	if m.CreateRepertoireWithCategoryFunc != nil {
		return m.CreateRepertoireWithCategoryFunc(ctx, userID, name, color, categoryID)
	}
	// Fall back to CreateRepertoireFunc if not set
	if m.CreateRepertoireFunc != nil {
		return m.CreateRepertoireFunc(ctx, userID, name, color)
	}
	return nil, nil
}

func (m *MockRepertoireService) SaveTree(ctx context.Context, userID, repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error) {
	if m.SaveTreeFunc != nil {
		return m.SaveTreeFunc(ctx, userID, repertoireID, treeData)
	}
	return nil, nil
}

func (m *MockRepertoireService) SetOrigin(ctx context.Context, repertoireID string, origin *models.RepertoireOrigin) error {
	if m.SetOriginFunc != nil {
		return m.SetOriginFunc(ctx, repertoireID, origin)
	}
	return nil
}

func (m *MockRepertoireService) ListRepertoires(ctx context.Context, userID string, color *models.Color) ([]models.Repertoire, error) {
	if m.ListRepertoiresFunc != nil {
		return m.ListRepertoiresFunc(ctx, userID, color)
	}
	return nil, nil
}
