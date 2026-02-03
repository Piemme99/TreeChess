package mocks

import (
	"time"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
)

// --- Service mocks ---

// MockLichessService implements services.LichessGameFetcher for testing
type MockLichessService struct {
	FetchGamesFunc    func(username string, options models.LichessImportOptions) (string, error)
	FetchStudyPGNFunc func(studyID, authToken string) (string, error)
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
	CreateRepertoireFunc func(userID, name string, color models.Color) (*models.Repertoire, error)
	SaveTreeFunc         func(repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error)
}

func (m *MockRepertoireService) CreateRepertoire(userID, name string, color models.Color) (*models.Repertoire, error) {
	if m.CreateRepertoireFunc != nil {
		return m.CreateRepertoireFunc(userID, name, color)
	}
	return nil, nil
}

func (m *MockRepertoireService) SaveTree(repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error) {
	if m.SaveTreeFunc != nil {
		return m.SaveTreeFunc(repertoireID, treeData)
	}
	return nil, nil
}

// --- Repository mocks ---

// MockFingerprintRepo is a mock implementation of GameFingerprintRepository for testing
type MockFingerprintRepo struct {
	CheckExistingFunc           func(userID string, fingerprints []string) (map[string]bool, error)
	SaveBatchFunc               func(userID, analysisID string, entries []repository.FingerprintEntry) error
	DeleteByAnalysisAndIndexFunc func(analysisID string, gameIndex int) error
}

func (m *MockFingerprintRepo) CheckExisting(userID string, fingerprints []string) (map[string]bool, error) {
	if m.CheckExistingFunc != nil {
		return m.CheckExistingFunc(userID, fingerprints)
	}
	return map[string]bool{}, nil
}

func (m *MockFingerprintRepo) SaveBatch(userID, analysisID string, entries []repository.FingerprintEntry) error {
	if m.SaveBatchFunc != nil {
		return m.SaveBatchFunc(userID, analysisID, entries)
	}
	return nil
}

func (m *MockFingerprintRepo) DeleteByAnalysisAndIndex(analysisID string, gameIndex int) error {
	if m.DeleteByAnalysisAndIndexFunc != nil {
		return m.DeleteByAnalysisAndIndexFunc(analysisID, gameIndex)
	}
	return nil
}

// MockEngineEvalRepo is a mock implementation of EngineEvalRepository for testing
type MockEngineEvalRepo struct {
	CreatePendingBatchFunc func(userID, analysisID string, gameCount int) error
	GetPendingFunc         func(limit int) ([]models.EngineEval, error)
	MarkProcessingFunc     func(id string) error
	SaveEvalsFunc          func(id string, evals []models.ExplorerMoveStats) error
	MarkFailedFunc         func(id string) error
	GetByUserFunc          func(userID string) ([]models.EngineEval, error)
}

func (m *MockEngineEvalRepo) CreatePendingBatch(userID, analysisID string, gameCount int) error {
	if m.CreatePendingBatchFunc != nil {
		return m.CreatePendingBatchFunc(userID, analysisID, gameCount)
	}
	return nil
}

func (m *MockEngineEvalRepo) GetPending(limit int) ([]models.EngineEval, error) {
	if m.GetPendingFunc != nil {
		return m.GetPendingFunc(limit)
	}
	return nil, nil
}

func (m *MockEngineEvalRepo) MarkProcessing(id string) error {
	if m.MarkProcessingFunc != nil {
		return m.MarkProcessingFunc(id)
	}
	return nil
}

func (m *MockEngineEvalRepo) SaveEvals(id string, evals []models.ExplorerMoveStats) error {
	if m.SaveEvalsFunc != nil {
		return m.SaveEvalsFunc(id, evals)
	}
	return nil
}

func (m *MockEngineEvalRepo) MarkFailed(id string) error {
	if m.MarkFailedFunc != nil {
		return m.MarkFailedFunc(id)
	}
	return nil
}

func (m *MockEngineEvalRepo) GetByUser(userID string) ([]models.EngineEval, error) {
	if m.GetByUserFunc != nil {
		return m.GetByUserFunc(userID)
	}
	return nil, nil
}

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
	SaveFunc               func(userID string, username, filename string, gameCount int, results []models.GameAnalysis) (*models.AnalysisSummary, error)
	GetAllFunc             func(userID string) ([]models.AnalysisSummary, error)
	GetByIDFunc            func(id string) (*models.AnalysisDetail, error)
	DeleteFunc             func(id string) error
	GetAllGamesFunc        func(userID string, limit, offset int, timeClass, opening, source string) (*models.GamesResponse, error)
	DeleteGameFunc         func(analysisID string, gameIndex int) error
	UpdateResultsFunc      func(analysisID string, results []models.GameAnalysis) error
	BelongsToUserFunc      func(id string, userID string) (bool, error)
	GetDistinctRepertoiresFunc func(userID string) ([]string, error)
	MarkGameViewedFunc         func(userID, analysisID string, gameIndex int) error
	GetViewedGamesFunc         func(userID string) (map[string]bool, error)
	GetAllGamesRawFunc         func(userID string) ([]models.RawAnalysis, error)
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

func (m *MockAnalysisRepo) GetAllGames(userID string, limit, offset int, timeClass, opening, source string) (*models.GamesResponse, error) {
	if m.GetAllGamesFunc != nil {
		return m.GetAllGamesFunc(userID, limit, offset, timeClass, opening, source)
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

func (m *MockAnalysisRepo) GetDistinctRepertoires(userID string) ([]string, error) {
	if m.GetDistinctRepertoiresFunc != nil {
		return m.GetDistinctRepertoiresFunc(userID)
	}
	return nil, nil
}

func (m *MockAnalysisRepo) MarkGameViewed(userID, analysisID string, gameIndex int) error {
	if m.MarkGameViewedFunc != nil {
		return m.MarkGameViewedFunc(userID, analysisID, gameIndex)
	}
	return nil
}

func (m *MockAnalysisRepo) GetViewedGames(userID string) (map[string]bool, error) {
	if m.GetViewedGamesFunc != nil {
		return m.GetViewedGamesFunc(userID)
	}
	return map[string]bool{}, nil
}

func (m *MockAnalysisRepo) GetAllGamesRaw(userID string) ([]models.RawAnalysis, error) {
	if m.GetAllGamesRawFunc != nil {
		return m.GetAllGamesRawFunc(userID)
	}
	return nil, nil
}

// MockUserRepo is a mock implementation of UserRepository for testing
type MockUserRepo struct {
	CreateFunc              func(username, passwordHash string) (*models.User, error)
	GetByUsernameFunc       func(username string) (*models.User, error)
	GetByIDFunc             func(id string) (*models.User, error)
	ExistsFunc              func(username string) (bool, error)
	FindByOAuthFunc         func(provider, oauthID string) (*models.User, error)
	CreateOAuthFunc         func(provider, oauthID, username string) (*models.User, error)
	UpdateProfileFunc       func(userID string, lichess, chesscom *string, timeFormatPrefs []string) (*models.User, error)
	UpdateSyncTimestampsFunc  func(userID string, lichessSyncAt, chesscomSyncAt *time.Time) error
	UpdateLichessTokenFunc    func(userID, token string) error
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

func (m *MockUserRepo) UpdateProfile(userID string, lichess, chesscom *string, timeFormatPrefs []string) (*models.User, error) {
	if m.UpdateProfileFunc != nil {
		return m.UpdateProfileFunc(userID, lichess, chesscom, timeFormatPrefs)
	}
	return nil, nil
}

func (m *MockUserRepo) UpdateSyncTimestamps(userID string, lichessSyncAt, chesscomSyncAt *time.Time) error {
	if m.UpdateSyncTimestampsFunc != nil {
		return m.UpdateSyncTimestampsFunc(userID, lichessSyncAt, chesscomSyncAt)
	}
	return nil
}

func (m *MockUserRepo) UpdateLichessToken(userID, token string) error {
	if m.UpdateLichessTokenFunc != nil {
		return m.UpdateLichessTokenFunc(userID, token)
	}
	return nil
}
