package mocks

import "github.com/treechess/backend/internal/models"

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
	GetAllGamesFunc   func(userID string, limit, offset int) (*models.GamesResponse, error)
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

func (m *MockAnalysisRepo) GetAllGames(userID string, limit, offset int) (*models.GamesResponse, error) {
	if m.GetAllGamesFunc != nil {
		return m.GetAllGamesFunc(userID, limit, offset)
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

// MockVideoRepo is a mock implementation of VideoRepository for testing
type MockVideoRepo struct {
	CreateImportFunc           func(userID string, youtubeURL, youtubeID, title string) (*models.VideoImport, error)
	GetImportByIDFunc          func(id string) (*models.VideoImport, error)
	GetAllImportsFunc          func(userID string) ([]models.VideoImport, error)
	UpdateImportStatusFunc     func(id string, status models.VideoImportStatus, progress int, errorMsg *string) error
	UpdateImportFramesFunc     func(id string, totalFrames, processedFrames int) error
	CompleteImportFunc         func(id string) error
	DeleteImportFunc           func(id string) error
	SavePositionsFunc          func(positions []models.VideoPosition) error
	GetPositionsByImportIDFunc func(importID string) ([]models.VideoPosition, error)
	SearchPositionsByFENFunc   func(userID string, fen string) ([]models.VideoSearchResult, error)
	BelongsToUserFunc          func(id string, userID string) (bool, error)
}

func (m *MockVideoRepo) CreateImport(userID string, youtubeURL, youtubeID, title string) (*models.VideoImport, error) {
	if m.CreateImportFunc != nil {
		return m.CreateImportFunc(userID, youtubeURL, youtubeID, title)
	}
	return nil, nil
}

func (m *MockVideoRepo) GetImportByID(id string) (*models.VideoImport, error) {
	if m.GetImportByIDFunc != nil {
		return m.GetImportByIDFunc(id)
	}
	return nil, nil
}

func (m *MockVideoRepo) GetAllImports(userID string) ([]models.VideoImport, error) {
	if m.GetAllImportsFunc != nil {
		return m.GetAllImportsFunc(userID)
	}
	return nil, nil
}

func (m *MockVideoRepo) UpdateImportStatus(id string, status models.VideoImportStatus, progress int, errorMsg *string) error {
	if m.UpdateImportStatusFunc != nil {
		return m.UpdateImportStatusFunc(id, status, progress, errorMsg)
	}
	return nil
}

func (m *MockVideoRepo) UpdateImportFrames(id string, totalFrames, processedFrames int) error {
	if m.UpdateImportFramesFunc != nil {
		return m.UpdateImportFramesFunc(id, totalFrames, processedFrames)
	}
	return nil
}

func (m *MockVideoRepo) CompleteImport(id string) error {
	if m.CompleteImportFunc != nil {
		return m.CompleteImportFunc(id)
	}
	return nil
}

func (m *MockVideoRepo) DeleteImport(id string) error {
	if m.DeleteImportFunc != nil {
		return m.DeleteImportFunc(id)
	}
	return nil
}

func (m *MockVideoRepo) SavePositions(positions []models.VideoPosition) error {
	if m.SavePositionsFunc != nil {
		return m.SavePositionsFunc(positions)
	}
	return nil
}

func (m *MockVideoRepo) GetPositionsByImportID(importID string) ([]models.VideoPosition, error) {
	if m.GetPositionsByImportIDFunc != nil {
		return m.GetPositionsByImportIDFunc(importID)
	}
	return nil, nil
}

func (m *MockVideoRepo) SearchPositionsByFEN(userID string, fen string) ([]models.VideoSearchResult, error) {
	if m.SearchPositionsByFENFunc != nil {
		return m.SearchPositionsByFENFunc(userID, fen)
	}
	return nil, nil
}

func (m *MockVideoRepo) BelongsToUser(id string, userID string) (bool, error) {
	if m.BelongsToUserFunc != nil {
		return m.BelongsToUserFunc(id, userID)
	}
	return true, nil
}

// MockUserRepo is a mock implementation of UserRepository for testing
type MockUserRepo struct {
	CreateFunc        func(username, passwordHash string) (*models.User, error)
	GetByUsernameFunc func(username string) (*models.User, error)
	GetByIDFunc       func(id string) (*models.User, error)
	ExistsFunc        func(username string) (bool, error)
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
