package mocks

import (
	"time"

	"github.com/treechess/backend/internal/models"
)

// MockRepertoireRepo is a mock implementation of RepertoireRepository for testing
type MockRepertoireRepo struct {
	GetByIDFunc       func(id string) (*models.Repertoire, error)
	GetByColorFunc    func(userID string, color models.Color) ([]models.Repertoire, error)
	GetAllFunc        func(userID string) ([]models.Repertoire, error)
	CreateFunc        func(userID string, name string, color models.Color) (*models.Repertoire, error)
	SaveFunc          func(id string, treeData models.RepertoireNode, metadata models.Metadata) (*models.Repertoire, error)
	UpdateNameFunc    func(id string, name string) (*models.Repertoire, error)
	DeleteFunc        func(id string) error
	CountFunc         func(userID string) (int, error)
	ExistsFunc        func(id string) (bool, error)
	BelongsToUserFunc func(id string, userID string) (bool, error)
}

func (m *MockRepertoireRepo) GetByID(id string) (*models.Repertoire, error) {
	if m.GetByIDFunc != nil {
		return m.GetByIDFunc(id)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) GetByColor(userID string, color models.Color) ([]models.Repertoire, error) {
	if m.GetByColorFunc != nil {
		return m.GetByColorFunc(userID, color)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) GetAll(userID string) ([]models.Repertoire, error) {
	if m.GetAllFunc != nil {
		return m.GetAllFunc(userID)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) Create(userID string, name string, color models.Color) (*models.Repertoire, error) {
	if m.CreateFunc != nil {
		return m.CreateFunc(userID, name, color)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) Save(id string, treeData models.RepertoireNode, metadata models.Metadata) (*models.Repertoire, error) {
	if m.SaveFunc != nil {
		return m.SaveFunc(id, treeData, metadata)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) UpdateName(id string, name string) (*models.Repertoire, error) {
	if m.UpdateNameFunc != nil {
		return m.UpdateNameFunc(id, name)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) Delete(id string) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(id)
	}
	return nil
}

func (m *MockRepertoireRepo) Count(userID string) (int, error) {
	if m.CountFunc != nil {
		return m.CountFunc(userID)
	}
	return 0, nil
}

func (m *MockRepertoireRepo) Exists(id string) (bool, error) {
	if m.ExistsFunc != nil {
		return m.ExistsFunc(id)
	}
	return false, nil
}

func (m *MockRepertoireRepo) BelongsToUser(id string, userID string) (bool, error) {
	if m.BelongsToUserFunc != nil {
		return m.BelongsToUserFunc(id, userID)
	}
	return true, nil
}

// MockAnalysisRepo is a mock implementation of AnalysisRepository for testing
type MockAnalysisRepo struct {
	SaveFunc          func(userID string, username, filename string, gameCount int, results []models.GameAnalysis) (*models.AnalysisSummary, error)
	GetAllFunc        func(userID string) ([]models.AnalysisSummary, error)
	GetByIDFunc       func(id string) (*models.AnalysisDetail, error)
	DeleteFunc        func(id string) error
	GetAllGamesFunc   func(userID string, limit, offset int, timeClass, opening string) (*models.GamesResponse, error)
	DeleteGameFunc    func(analysisID string, gameIndex int) error
	UpdateResultsFunc func(analysisID string, results []models.GameAnalysis) error
	BelongsToUserFunc func(id string, userID string) (bool, error)
}

func (m *MockAnalysisRepo) Save(userID string, username, filename string, gameCount int, results []models.GameAnalysis) (*models.AnalysisSummary, error) {
	if m.SaveFunc != nil {
		return m.SaveFunc(userID, username, filename, gameCount, results)
	}
	return nil, nil
}

func (m *MockAnalysisRepo) GetAll(userID string) ([]models.AnalysisSummary, error) {
	if m.GetAllFunc != nil {
		return m.GetAllFunc(userID)
	}
	return nil, nil
}

func (m *MockAnalysisRepo) GetByID(id string) (*models.AnalysisDetail, error) {
	if m.GetByIDFunc != nil {
		return m.GetByIDFunc(id)
	}
	return nil, nil
}

func (m *MockAnalysisRepo) Delete(id string) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(id)
	}
	return nil
}

func (m *MockAnalysisRepo) GetAllGames(userID string, limit, offset int, timeClass, opening string) (*models.GamesResponse, error) {
	if m.GetAllGamesFunc != nil {
		return m.GetAllGamesFunc(userID, limit, offset, timeClass, opening)
	}
	return nil, nil
}

func (m *MockAnalysisRepo) DeleteGame(analysisID string, gameIndex int) error {
	if m.DeleteGameFunc != nil {
		return m.DeleteGameFunc(analysisID, gameIndex)
	}
	return nil
}

func (m *MockAnalysisRepo) UpdateResults(analysisID string, results []models.GameAnalysis) error {
	if m.UpdateResultsFunc != nil {
		return m.UpdateResultsFunc(analysisID, results)
	}
	return nil
}

func (m *MockAnalysisRepo) BelongsToUser(id string, userID string) (bool, error) {
	if m.BelongsToUserFunc != nil {
		return m.BelongsToUserFunc(id, userID)
	}
	return true, nil
}

// MockUserRepo is a mock implementation of UserRepository for testing
type MockUserRepo struct {
	CreateFunc              func(username, passwordHash string) (*models.User, error)
	GetByUsernameFunc       func(username string) (*models.User, error)
	GetByIDFunc             func(id string) (*models.User, error)
	ExistsFunc              func(username string) (bool, error)
	FindByOAuthFunc         func(provider, oauthID string) (*models.User, error)
	CreateOAuthFunc         func(provider, oauthID, username string) (*models.User, error)
	UpdateProfileFunc       func(userID string, lichess, chesscom *string) (*models.User, error)
	UpdateSyncTimestampsFunc func(userID string, lichessSyncAt, chesscomSyncAt *time.Time) error
}

func (m *MockUserRepo) Create(username, passwordHash string) (*models.User, error) {
	if m.CreateFunc != nil {
		return m.CreateFunc(username, passwordHash)
	}
	return nil, nil
}

func (m *MockUserRepo) GetByUsername(username string) (*models.User, error) {
	if m.GetByUsernameFunc != nil {
		return m.GetByUsernameFunc(username)
	}
	return nil, nil
}

func (m *MockUserRepo) GetByID(id string) (*models.User, error) {
	if m.GetByIDFunc != nil {
		return m.GetByIDFunc(id)
	}
	return nil, nil
}

func (m *MockUserRepo) Exists(username string) (bool, error) {
	if m.ExistsFunc != nil {
		return m.ExistsFunc(username)
	}
	return false, nil
}

func (m *MockUserRepo) FindByOAuth(provider, oauthID string) (*models.User, error) {
	if m.FindByOAuthFunc != nil {
		return m.FindByOAuthFunc(provider, oauthID)
	}
	return nil, nil
}

func (m *MockUserRepo) CreateOAuth(provider, oauthID, username string) (*models.User, error) {
	if m.CreateOAuthFunc != nil {
		return m.CreateOAuthFunc(provider, oauthID, username)
	}
	return nil, nil
}

func (m *MockUserRepo) UpdateProfile(userID string, lichess, chesscom *string) (*models.User, error) {
	if m.UpdateProfileFunc != nil {
		return m.UpdateProfileFunc(userID, lichess, chesscom)
	}
	return nil, nil
}

func (m *MockUserRepo) UpdateSyncTimestamps(userID string, lichessSyncAt, chesscomSyncAt *time.Time) error {
	if m.UpdateSyncTimestampsFunc != nil {
		return m.UpdateSyncTimestampsFunc(userID, lichessSyncAt, chesscomSyncAt)
	}
	return nil
}
