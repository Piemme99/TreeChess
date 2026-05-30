package mocks

import (
	"fmt"

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
	ParseAndAnalyzeFunc func(filename, username, userID, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error)
}

func (m *MockImportService) ParseAndAnalyze(filename, username, userID, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error) {
	if m.ParseAndAnalyzeFunc != nil {
		return m.ParseAndAnalyzeFunc(filename, username, userID, pgnData)
	}
	return &models.AnalysisSummary{}, nil, nil
}

// MockRepertoireService implements services.RepertoireManager for testing
type MockRepertoireService struct {
	CreateRepertoireFunc             func(userID, name string, color models.Color) (*models.Repertoire, error)
	CreateRepertoireWithCategoryFunc func(userID, name string, color models.Color, categoryID *string) (*models.Repertoire, error)
	SaveTreeFunc                     func(userID, repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error)
	SetOriginFunc                    func(repertoireID string, origin *models.RepertoireOrigin) error
	ListRepertoiresFunc              func(userID string, color *models.Color) ([]models.Repertoire, error)
	// CreateCategoryFunc backs the category creation performed inside the default
	// PersistStudyImport. Optional; when nil a category with a fixed ID is returned.
	CreateCategoryFunc func(userID, name string, color models.Color) (*models.Category, error)
	// PersistStudyImportFunc overrides the default PersistStudyImport behavior,
	// letting tests inject a failure (to assert the import surfaces an error and
	// leaves nothing partial). When nil, PersistStudyImport replays the plan
	// against CreateRepertoire(WithCategory)/SaveTree/SetOrigin so existing tests
	// that only set those funcs keep working.
	PersistStudyImportFunc func(userID string, plan models.StudyImportPlan) (*models.StudyImportPersistResult, error)
}

func (m *MockRepertoireService) CreateRepertoire(userID, name string, color models.Color) (*models.Repertoire, error) {
	if m.CreateRepertoireFunc != nil {
		return m.CreateRepertoireFunc(userID, name, color)
	}
	return nil, nil
}

func (m *MockRepertoireService) CreateRepertoireWithCategory(userID, name string, color models.Color, categoryID *string) (*models.Repertoire, error) {
	if m.CreateRepertoireWithCategoryFunc != nil {
		return m.CreateRepertoireWithCategoryFunc(userID, name, color, categoryID)
	}
	// Fall back to CreateRepertoireFunc if not set
	if m.CreateRepertoireFunc != nil {
		return m.CreateRepertoireFunc(userID, name, color)
	}
	return nil, nil
}

func (m *MockRepertoireService) SaveTree(userID, repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error) {
	if m.SaveTreeFunc != nil {
		return m.SaveTreeFunc(userID, repertoireID, treeData)
	}
	return nil, nil
}

func (m *MockRepertoireService) SetOrigin(repertoireID string, origin *models.RepertoireOrigin) error {
	if m.SetOriginFunc != nil {
		return m.SetOriginFunc(repertoireID, origin)
	}
	return nil
}

func (m *MockRepertoireService) ListRepertoires(userID string, color *models.Color) ([]models.Repertoire, error) {
	if m.ListRepertoiresFunc != nil {
		return m.ListRepertoiresFunc(userID, color)
	}
	return nil, nil
}

// PersistStudyImport replays the plan against the create/save/origin funcs so
// existing tests that only configure those funcs keep working. Set
// PersistStudyImportFunc to model an atomic failure instead.
func (m *MockRepertoireService) PersistStudyImport(userID string, plan models.StudyImportPlan) (*models.StudyImportPersistResult, error) {
	if m.PersistStudyImportFunc != nil {
		return m.PersistStudyImportFunc(userID, plan)
	}

	result := &models.StudyImportPersistResult{}
	var categoryID *string
	if plan.Category != nil {
		var cat *models.Category
		var err error
		if m.CreateCategoryFunc != nil {
			cat, err = m.CreateCategoryFunc(userID, plan.Category.Name, plan.Category.Color)
		} else {
			cat = &models.Category{ID: "cat-1", Name: plan.Category.Name, Color: plan.Category.Color}
		}
		if err != nil {
			return nil, fmt.Errorf("failed to create category: %w", err)
		}
		result.Category = cat
		if cat != nil {
			categoryID = &cat.ID
		}
	}

	for _, spec := range plan.Repertoires {
		var rep *models.Repertoire
		var err error
		if categoryID != nil && spec.UseCategory {
			rep, err = m.CreateRepertoireWithCategory(userID, spec.Name, spec.Color, categoryID)
		} else {
			rep, err = m.CreateRepertoire(userID, spec.Name, spec.Color)
		}
		if err != nil {
			return nil, fmt.Errorf("failed to create repertoire %q: %w", spec.Name, err)
		}

		repID := ""
		if rep != nil {
			repID = rep.ID
		}
		saved, err := m.SaveTree(userID, repID, spec.Tree)
		if err != nil {
			return nil, fmt.Errorf("failed to save repertoire %q: %w", spec.Name, err)
		}
		if saved == nil {
			saved = &models.Repertoire{ID: repID, Name: spec.Name, Color: spec.Color, TreeData: spec.Tree}
		}

		if spec.Origin != nil {
			if err := m.SetOrigin(saved.ID, spec.Origin); err != nil {
				return nil, fmt.Errorf("failed to set origin on repertoire %q: %w", spec.Name, err)
			}
			saved.Origin = spec.Origin
		}

		result.Repertoires = append(result.Repertoires, *saved)
	}

	return result, nil
}
