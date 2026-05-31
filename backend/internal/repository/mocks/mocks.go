package mocks

import (
	"context"
	"time"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
)

// --- Repository mocks ---

// MockFingerprintRepo is a mock implementation of GameFingerprintRepository for testing
type MockFingerprintRepo struct {
	CheckExistingFunc func(ctx context.Context, userID string, fingerprints []string) (map[string]bool, error)
	SaveBatchFunc     func(ctx context.Context, userID, analysisID string, entries []repository.FingerprintEntry) error
}

func (m *MockFingerprintRepo) CheckExisting(ctx context.Context, userID string, fingerprints []string) (map[string]bool, error) {
	if m.CheckExistingFunc != nil {
		return m.CheckExistingFunc(ctx, userID, fingerprints)
	}
	return map[string]bool{}, nil
}

func (m *MockFingerprintRepo) SaveBatch(ctx context.Context, userID, analysisID string, entries []repository.FingerprintEntry) error {
	if m.SaveBatchFunc != nil {
		return m.SaveBatchFunc(ctx, userID, analysisID, entries)
	}
	return nil
}

// MockEngineEvalRepo is a mock implementation of EngineEvalRepository for testing
type MockEngineEvalRepo struct {
	CreatePendingBatchFunc   func(ctx context.Context, userID, analysisID string, gameCount int) error
	ClaimPendingFunc         func(ctx context.Context, limit int) ([]models.EngineEval, error)
	GetPendingFunc           func(ctx context.Context, limit int) ([]models.EngineEval, error)
	MarkProcessingFunc       func(ctx context.Context, id string) error
	SaveEvalsFunc            func(ctx context.Context, id string, evals []models.ExplorerMoveStats) error
	MarkFailedFunc           func(ctx context.Context, id string) error
	GetByUserFunc            func(ctx context.Context, userID string) ([]models.EngineEval, error)
	ResetStaleProcessingFunc func(ctx context.Context) (int, error)
}

func (m *MockEngineEvalRepo) CreatePendingBatch(ctx context.Context, userID, analysisID string, gameCount int) error {
	if m.CreatePendingBatchFunc != nil {
		return m.CreatePendingBatchFunc(ctx, userID, analysisID, gameCount)
	}
	return nil
}

func (m *MockEngineEvalRepo) ClaimPending(ctx context.Context, limit int) ([]models.EngineEval, error) {
	if m.ClaimPendingFunc != nil {
		return m.ClaimPendingFunc(ctx, limit)
	}
	return nil, nil
}

func (m *MockEngineEvalRepo) GetPending(ctx context.Context, limit int) ([]models.EngineEval, error) {
	if m.GetPendingFunc != nil {
		return m.GetPendingFunc(ctx, limit)
	}
	return nil, nil
}

func (m *MockEngineEvalRepo) MarkProcessing(ctx context.Context, id string) error {
	if m.MarkProcessingFunc != nil {
		return m.MarkProcessingFunc(ctx, id)
	}
	return nil
}

func (m *MockEngineEvalRepo) SaveEvals(ctx context.Context, id string, evals []models.ExplorerMoveStats) error {
	if m.SaveEvalsFunc != nil {
		return m.SaveEvalsFunc(ctx, id, evals)
	}
	return nil
}

func (m *MockEngineEvalRepo) MarkFailed(ctx context.Context, id string) error {
	if m.MarkFailedFunc != nil {
		return m.MarkFailedFunc(ctx, id)
	}
	return nil
}

func (m *MockEngineEvalRepo) GetByUser(ctx context.Context, userID string) ([]models.EngineEval, error) {
	if m.GetByUserFunc != nil {
		return m.GetByUserFunc(ctx, userID)
	}
	return nil, nil
}

func (m *MockEngineEvalRepo) ResetStaleProcessing(ctx context.Context) (int, error) {
	if m.ResetStaleProcessingFunc != nil {
		return m.ResetStaleProcessingFunc(ctx)
	}
	return 0, nil
}

// MockRepertoireRepo is a mock implementation of RepertoireRepository for testing
type MockRepertoireRepo struct {
	GetByIDFunc                   func(ctx context.Context, id string, userID string) (*models.Repertoire, error)
	GetByColorFunc                func(ctx context.Context, userID string, color models.Color) ([]models.Repertoire, error)
	GetAllFunc                    func(ctx context.Context, userID string) ([]models.Repertoire, error)
	CreateFunc                    func(ctx context.Context, userID string, name string, color models.Color) (*models.Repertoire, error)
	CreateWithCategoryFunc        func(ctx context.Context, userID, name string, color models.Color, categoryID *string) (*models.Repertoire, error)
	CreateWithIsPublicFunc        func(ctx context.Context, userID, name string, color models.Color, isPublic bool) (*models.Repertoire, error)
	CreateWithIsPublicAndDescFunc func(ctx context.Context, userID, name, description string, color models.Color, isPublic bool) (*models.Repertoire, error)
	SaveFunc                      func(ctx context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error)
	UpdateNameFunc                func(ctx context.Context, id string, userID string, name string) (*models.Repertoire, error)
	UpdateDescriptionFunc         func(ctx context.Context, id string, userID string, description string) (*models.Repertoire, error)
	UpdateCategoryFunc            func(ctx context.Context, id string, userID string, categoryID *string) (*models.Repertoire, error)
	UpdateVisibilityFunc          func(ctx context.Context, id string, userID string, isPublic bool) (*models.Repertoire, error)
	DeleteFunc                    func(ctx context.Context, id string, userID string) error
	CountFunc                     func(ctx context.Context, userID string) (int, error)
	ExistsFunc                    func(ctx context.Context, id string) (bool, error)
	BelongsToUserFunc             func(ctx context.Context, id string, userID string) (bool, error)
	GetByCategoryFunc             func(ctx context.Context, categoryID string) ([]models.Repertoire, error)
	GetUncategorizedFunc          func(ctx context.Context, userID string, color models.Color) ([]models.Repertoire, error)
	GetAllPublicFunc              func(ctx context.Context) ([]models.Repertoire, error)
	GetPublicByIDFunc             func(ctx context.Context, id string) (*models.Repertoire, error)
	GetOwnerIDFunc                func(ctx context.Context, id string) (string, error)
	UpdateOriginFunc              func(ctx context.Context, id string, userID string, origin *models.RepertoireOrigin) error
	// CreateCategoryFunc backs the category Create exposed on the transaction
	// surface (repository.RepertoireTx). Defaults to a no-op returning nil.
	CreateCategoryFunc func(ctx context.Context, userID, name string, color models.Color) (*models.Category, error)
	// WithinTxFunc overrides the default WithinTx behavior, letting tests inject
	// a mid-transaction failure or assert rollback. When nil, WithinTx runs the
	// closure against a transaction-bound repo that delegates to this mock's
	// Create/Save/Delete/UpdateOrigin/CreateCategory funcs and "commits" by
	// simply returning the closure's error.
	WithinTxFunc func(ctx context.Context, fn func(tx repository.RepertoireTx) error) error
}

// mockRepertoireTx adapts MockRepertoireRepo to the repository.RepertoireTx
// surface so closures passed to WithinTx exercise the same mock funcs.
type mockRepertoireTx struct {
	repo *MockRepertoireRepo
}

func (t *mockRepertoireTx) Create(ctx context.Context, userID string, name string, color models.Color) (*models.Repertoire, error) {
	return t.repo.Create(ctx, userID, name, color)
}

func (t *mockRepertoireTx) CreateWithCategory(ctx context.Context, userID string, name string, color models.Color, categoryID *string) (*models.Repertoire, error) {
	return t.repo.CreateWithCategory(ctx, userID, name, color, categoryID)
}

func (t *mockRepertoireTx) Save(ctx context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
	return t.repo.Save(ctx, id, userID, treeData, metadata, expectedVersion)
}

func (t *mockRepertoireTx) UpdateOrigin(ctx context.Context, id string, userID string, origin *models.RepertoireOrigin) error {
	return t.repo.UpdateOrigin(ctx, id, userID, origin)
}

func (t *mockRepertoireTx) Delete(ctx context.Context, id string, userID string) error {
	return t.repo.Delete(ctx, id, userID)
}

func (t *mockRepertoireTx) CreateCategory(ctx context.Context, userID, name string, color models.Color) (*models.Category, error) {
	if t.repo.CreateCategoryFunc != nil {
		return t.repo.CreateCategoryFunc(ctx, userID, name, color)
	}
	return nil, nil
}

// WithinTx runs fn against a transaction-bound view of the mock. By default it
// behaves like a successful transaction: the closure runs and its error is
// returned verbatim (a nil error means "committed"). Set WithinTxFunc to model
// a failed commit or to assert rollback semantics.
func (m *MockRepertoireRepo) WithinTx(ctx context.Context, fn func(tx repository.RepertoireTx) error) error {
	if m.WithinTxFunc != nil {
		return m.WithinTxFunc(ctx, fn)
	}
	return fn(&mockRepertoireTx{repo: m})
}

func (m *MockRepertoireRepo) GetByID(ctx context.Context, id string, userID string) (*models.Repertoire, error) {
	if m.GetByIDFunc != nil {
		return m.GetByIDFunc(ctx, id, userID)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) GetByColor(ctx context.Context, userID string, color models.Color) ([]models.Repertoire, error) {
	if m.GetByColorFunc != nil {
		return m.GetByColorFunc(ctx, userID, color)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) GetAll(ctx context.Context, userID string) ([]models.Repertoire, error) {
	if m.GetAllFunc != nil {
		return m.GetAllFunc(ctx, userID)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) Create(ctx context.Context, userID string, name string, color models.Color) (*models.Repertoire, error) {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, userID, name, color)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) CreateWithCategory(ctx context.Context, userID, name string, color models.Color, categoryID *string) (*models.Repertoire, error) {
	if m.CreateWithCategoryFunc != nil {
		return m.CreateWithCategoryFunc(ctx, userID, name, color, categoryID)
	}
	// Fall back to CreateFunc if not set
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, userID, name, color)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) Save(ctx context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
	if m.SaveFunc != nil {
		return m.SaveFunc(ctx, id, userID, treeData, metadata, expectedVersion)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) UpdateName(ctx context.Context, id string, userID string, name string) (*models.Repertoire, error) {
	if m.UpdateNameFunc != nil {
		return m.UpdateNameFunc(ctx, id, userID, name)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) UpdateDescription(ctx context.Context, id string, userID string, description string) (*models.Repertoire, error) {
	if m.UpdateDescriptionFunc != nil {
		return m.UpdateDescriptionFunc(ctx, id, userID, description)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) UpdateCategory(ctx context.Context, id string, userID string, categoryID *string) (*models.Repertoire, error) {
	if m.UpdateCategoryFunc != nil {
		return m.UpdateCategoryFunc(ctx, id, userID, categoryID)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) Delete(ctx context.Context, id string, userID string) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(ctx, id, userID)
	}
	return nil
}

func (m *MockRepertoireRepo) Count(ctx context.Context, userID string) (int, error) {
	if m.CountFunc != nil {
		return m.CountFunc(ctx, userID)
	}
	return 0, nil
}

func (m *MockRepertoireRepo) Exists(ctx context.Context, id string) (bool, error) {
	if m.ExistsFunc != nil {
		return m.ExistsFunc(ctx, id)
	}
	return false, nil
}

func (m *MockRepertoireRepo) BelongsToUser(ctx context.Context, id string, userID string) (bool, error) {
	if m.BelongsToUserFunc != nil {
		return m.BelongsToUserFunc(ctx, id, userID)
	}
	return true, nil
}

func (m *MockRepertoireRepo) GetByCategory(ctx context.Context, categoryID string) ([]models.Repertoire, error) {
	if m.GetByCategoryFunc != nil {
		return m.GetByCategoryFunc(ctx, categoryID)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) GetUncategorized(ctx context.Context, userID string, color models.Color) ([]models.Repertoire, error) {
	if m.GetUncategorizedFunc != nil {
		return m.GetUncategorizedFunc(ctx, userID, color)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) CreateWithIsPublic(ctx context.Context, userID, name string, color models.Color, isPublic bool) (*models.Repertoire, error) {
	if m.CreateWithIsPublicFunc != nil {
		return m.CreateWithIsPublicFunc(ctx, userID, name, color, isPublic)
	}
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, userID, name, color)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) CreateWithIsPublicAndDescription(ctx context.Context, userID, name, description string, color models.Color, isPublic bool) (*models.Repertoire, error) {
	if m.CreateWithIsPublicAndDescFunc != nil {
		return m.CreateWithIsPublicAndDescFunc(ctx, userID, name, description, color, isPublic)
	}
	if m.CreateWithIsPublicFunc != nil {
		return m.CreateWithIsPublicFunc(ctx, userID, name, color, isPublic)
	}
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, userID, name, color)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) UpdateVisibility(ctx context.Context, id string, userID string, isPublic bool) (*models.Repertoire, error) {
	if m.UpdateVisibilityFunc != nil {
		return m.UpdateVisibilityFunc(ctx, id, userID, isPublic)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) GetAllPublic(ctx context.Context) ([]models.Repertoire, error) {
	if m.GetAllPublicFunc != nil {
		return m.GetAllPublicFunc(ctx)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) GetPublicByID(ctx context.Context, id string) (*models.Repertoire, error) {
	if m.GetPublicByIDFunc != nil {
		return m.GetPublicByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *MockRepertoireRepo) GetOwnerID(ctx context.Context, id string) (string, error) {
	if m.GetOwnerIDFunc != nil {
		return m.GetOwnerIDFunc(ctx, id)
	}
	return "", nil
}

func (m *MockRepertoireRepo) UpdateOrigin(ctx context.Context, id string, userID string, origin *models.RepertoireOrigin) error {
	if m.UpdateOriginFunc != nil {
		return m.UpdateOriginFunc(ctx, id, userID, origin)
	}
	return nil
}

// MockAnalysisRepo is a mock implementation of AnalysisRepository for testing
type MockAnalysisRepo struct {
	SaveFunc                   func(ctx context.Context, userID string, username, filename string, gameCount int, results []models.GameAnalysis) (*models.AnalysisSummary, error)
	GetAllFunc                 func(ctx context.Context, userID string) ([]models.AnalysisSummary, error)
	GetByIDFunc                func(ctx context.Context, id string, userID string) (*models.AnalysisDetail, error)
	DeleteFunc                 func(ctx context.Context, id string, userID string) error
	GetAllGamesFunc            func(ctx context.Context, userID string, limit, offset int, timeClass, opening, source string, onlyNew bool) (*models.GamesResponse, error)
	UpdateResultsFunc          func(ctx context.Context, analysisID string, userID string, results []models.GameAnalysis) error
	MutateResultsFunc          func(ctx context.Context, analysisID string, userID string, mutate repository.ResultsMutator) error
	BelongsToUserFunc          func(ctx context.Context, id string, userID string) (bool, error)
	GetDistinctRepertoiresFunc func(ctx context.Context, userID string) ([]models.RepertoireFilterOption, error)
	MarkGameViewedFunc         func(ctx context.Context, userID, analysisID string, gameIndex int) error
	GetViewedGamesFunc         func(ctx context.Context, userID string) (map[string]bool, error)
	GetAllGamesRawFunc         func(ctx context.Context, userID string) ([]models.RawAnalysis, error)
}

func (m *MockAnalysisRepo) Save(ctx context.Context, userID string, username, filename string, gameCount int, results []models.GameAnalysis) (*models.AnalysisSummary, error) {
	if m.SaveFunc != nil {
		return m.SaveFunc(ctx, userID, username, filename, gameCount, results)
	}
	return nil, nil
}

func (m *MockAnalysisRepo) GetAll(ctx context.Context, userID string) ([]models.AnalysisSummary, error) {
	if m.GetAllFunc != nil {
		return m.GetAllFunc(ctx, userID)
	}
	return nil, nil
}

func (m *MockAnalysisRepo) GetByID(ctx context.Context, id string, userID string) (*models.AnalysisDetail, error) {
	if m.GetByIDFunc != nil {
		return m.GetByIDFunc(ctx, id, userID)
	}
	return nil, nil
}

func (m *MockAnalysisRepo) Delete(ctx context.Context, id string, userID string) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(ctx, id, userID)
	}
	return nil
}

func (m *MockAnalysisRepo) GetAllGames(ctx context.Context, userID string, limit, offset int, timeClass, opening, source string, onlyNew bool) (*models.GamesResponse, error) {
	if m.GetAllGamesFunc != nil {
		return m.GetAllGamesFunc(ctx, userID, limit, offset, timeClass, opening, source, onlyNew)
	}
	return nil, nil
}

func (m *MockAnalysisRepo) UpdateResults(ctx context.Context, analysisID string, userID string, results []models.GameAnalysis) error {
	if m.UpdateResultsFunc != nil {
		return m.UpdateResultsFunc(ctx, analysisID, userID, results)
	}
	return nil
}

// MutateResults mimics the real repository's transactional read-modify-write.
// When MutateResultsFunc is set it is used directly. Otherwise the mock resolves
// the analysis's current results (via GetByIDFunc, falling back to a matching
// entry from GetAllGamesRawFunc), runs the mutator, and persists the result via
// UpdateResultsFunc when the mutator reports a change. This lets tests configured
// only with GetByID/GetAllGamesRaw + UpdateResults exercise the mutate path
// without extra wiring.
func (m *MockAnalysisRepo) MutateResults(ctx context.Context, analysisID string, userID string, mutate repository.ResultsMutator) error {
	if m.MutateResultsFunc != nil {
		return m.MutateResultsFunc(ctx, analysisID, userID, mutate)
	}

	current, err := m.resolveResults(ctx, analysisID, userID)
	if err != nil {
		return err
	}

	updated, changed, err := mutate(current)
	if err != nil {
		return err
	}
	if !changed {
		return nil
	}
	return m.UpdateResults(ctx, analysisID, userID, updated)
}

// resolveResults reconstructs an analysis's current results for the default
// MutateResults implementation, mirroring what a real SELECT ... FOR UPDATE
// would return.
func (m *MockAnalysisRepo) resolveResults(ctx context.Context, analysisID string, userID string) ([]models.GameAnalysis, error) {
	if m.GetByIDFunc != nil {
		detail, err := m.GetByIDFunc(ctx, analysisID, userID)
		if err != nil {
			return nil, err
		}
		if detail != nil {
			return detail.Results, nil
		}
	}
	if m.GetAllGamesRawFunc != nil {
		analyses, err := m.GetAllGamesRawFunc(ctx, "")
		if err != nil {
			return nil, err
		}
		for i := range analyses {
			if analyses[i].ID == analysisID {
				return analyses[i].Results, nil
			}
		}
	}
	return nil, nil
}

func (m *MockAnalysisRepo) BelongsToUser(ctx context.Context, id string, userID string) (bool, error) {
	if m.BelongsToUserFunc != nil {
		return m.BelongsToUserFunc(ctx, id, userID)
	}
	return true, nil
}

func (m *MockAnalysisRepo) GetDistinctRepertoires(ctx context.Context, userID string) ([]models.RepertoireFilterOption, error) {
	if m.GetDistinctRepertoiresFunc != nil {
		return m.GetDistinctRepertoiresFunc(ctx, userID)
	}
	return nil, nil
}

func (m *MockAnalysisRepo) MarkGameViewed(ctx context.Context, userID, analysisID string, gameIndex int) error {
	if m.MarkGameViewedFunc != nil {
		return m.MarkGameViewedFunc(ctx, userID, analysisID, gameIndex)
	}
	return nil
}

func (m *MockAnalysisRepo) GetViewedGames(ctx context.Context, userID string) (map[string]bool, error) {
	if m.GetViewedGamesFunc != nil {
		return m.GetViewedGamesFunc(ctx, userID)
	}
	return map[string]bool{}, nil
}

func (m *MockAnalysisRepo) GetAllGamesRaw(ctx context.Context, userID string) ([]models.RawAnalysis, error) {
	if m.GetAllGamesRawFunc != nil {
		return m.GetAllGamesRawFunc(ctx, userID)
	}
	return nil, nil
}

// MockUserRepo is a mock implementation of UserRepository for testing
type MockUserRepo struct {
	CreateFunc               func(ctx context.Context, email, username, passwordHash string) (*models.User, error)
	GetByUsernameFunc        func(ctx context.Context, username string) (*models.User, error)
	GetByEmailFunc           func(ctx context.Context, email string) (*models.User, error)
	GetByIDFunc              func(ctx context.Context, id string) (*models.User, error)
	ExistsFunc               func(ctx context.Context, username string) (bool, error)
	EmailExistsFunc          func(ctx context.Context, email string) (bool, error)
	FindByOAuthFunc          func(ctx context.Context, provider, oauthID string) (*models.User, error)
	CreateOAuthFunc          func(ctx context.Context, provider, oauthID, username string) (*models.User, error)
	UpdateProfileFunc        func(ctx context.Context, userID string, lichess, chesscom *string, timeFormatPrefs []string) (*models.User, error)
	UpdateSyncTimestampsFunc func(ctx context.Context, userID string, lichessSyncAt, chesscomSyncAt *time.Time) error
	ResetSyncTimestampsFunc  func(ctx context.Context, userID string) error
	UpdateLichessTokenFunc   func(ctx context.Context, userID, token string) error
	UpdatePasswordFunc       func(ctx context.Context, userID, passwordHash string) error
	DeleteFunc               func(ctx context.Context, id string) error
}

func (m *MockUserRepo) Create(ctx context.Context, email, username, passwordHash string) (*models.User, error) {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, email, username, passwordHash)
	}
	return nil, nil
}

func (m *MockUserRepo) GetByUsername(ctx context.Context, username string) (*models.User, error) {
	if m.GetByUsernameFunc != nil {
		return m.GetByUsernameFunc(ctx, username)
	}
	return nil, nil
}

func (m *MockUserRepo) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	if m.GetByEmailFunc != nil {
		return m.GetByEmailFunc(ctx, email)
	}
	return nil, nil
}

func (m *MockUserRepo) GetByID(ctx context.Context, id string) (*models.User, error) {
	if m.GetByIDFunc != nil {
		return m.GetByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *MockUserRepo) Exists(ctx context.Context, username string) (bool, error) {
	if m.ExistsFunc != nil {
		return m.ExistsFunc(ctx, username)
	}
	return false, nil
}

func (m *MockUserRepo) EmailExists(ctx context.Context, email string) (bool, error) {
	if m.EmailExistsFunc != nil {
		return m.EmailExistsFunc(ctx, email)
	}
	return false, nil
}

func (m *MockUserRepo) FindByOAuth(ctx context.Context, provider, oauthID string) (*models.User, error) {
	if m.FindByOAuthFunc != nil {
		return m.FindByOAuthFunc(ctx, provider, oauthID)
	}
	return nil, nil
}

func (m *MockUserRepo) CreateOAuth(ctx context.Context, provider, oauthID, username string) (*models.User, error) {
	if m.CreateOAuthFunc != nil {
		return m.CreateOAuthFunc(ctx, provider, oauthID, username)
	}
	return nil, nil
}

func (m *MockUserRepo) UpdateProfile(ctx context.Context, userID string, lichess, chesscom *string, timeFormatPrefs []string) (*models.User, error) {
	if m.UpdateProfileFunc != nil {
		return m.UpdateProfileFunc(ctx, userID, lichess, chesscom, timeFormatPrefs)
	}
	return nil, nil
}

func (m *MockUserRepo) UpdateSyncTimestamps(ctx context.Context, userID string, lichessSyncAt, chesscomSyncAt *time.Time) error {
	if m.UpdateSyncTimestampsFunc != nil {
		return m.UpdateSyncTimestampsFunc(ctx, userID, lichessSyncAt, chesscomSyncAt)
	}
	return nil
}

func (m *MockUserRepo) ResetSyncTimestamps(ctx context.Context, userID string) error {
	if m.ResetSyncTimestampsFunc != nil {
		return m.ResetSyncTimestampsFunc(ctx, userID)
	}
	return nil
}

func (m *MockUserRepo) UpdateLichessToken(ctx context.Context, userID, token string) error {
	if m.UpdateLichessTokenFunc != nil {
		return m.UpdateLichessTokenFunc(ctx, userID, token)
	}
	return nil
}

func (m *MockUserRepo) UpdatePassword(ctx context.Context, userID, passwordHash string) error {
	if m.UpdatePasswordFunc != nil {
		return m.UpdatePasswordFunc(ctx, userID, passwordHash)
	}
	return nil
}

func (m *MockUserRepo) Delete(ctx context.Context, id string) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(ctx, id)
	}
	return nil
}

// MockCategoryRepo is a mock implementation of CategoryRepository for testing
type MockCategoryRepo struct {
	GetByIDFunc           func(ctx context.Context, id, userID string) (*models.Category, error)
	GetByUserAndColorFunc func(ctx context.Context, userID string, color models.Color) ([]models.Category, error)
	GetAllFunc            func(ctx context.Context, userID string) ([]models.Category, error)
	CreateFunc            func(ctx context.Context, userID, name string, color models.Color) (*models.Category, error)
	UpdateNameFunc        func(ctx context.Context, id, userID, name string) (*models.Category, error)
	DeleteFunc            func(ctx context.Context, id, userID string) error
	BelongsToUserFunc     func(ctx context.Context, id, userID string) (bool, error)
	ExistsFunc            func(ctx context.Context, id string) (bool, error)
	CountFunc             func(ctx context.Context, userID string) (int, error)
}

func (m *MockCategoryRepo) GetByID(ctx context.Context, id, userID string) (*models.Category, error) {
	if m.GetByIDFunc != nil {
		return m.GetByIDFunc(ctx, id, userID)
	}
	return nil, nil
}

func (m *MockCategoryRepo) GetByUserAndColor(ctx context.Context, userID string, color models.Color) ([]models.Category, error) {
	if m.GetByUserAndColorFunc != nil {
		return m.GetByUserAndColorFunc(ctx, userID, color)
	}
	return nil, nil
}

func (m *MockCategoryRepo) GetAll(ctx context.Context, userID string) ([]models.Category, error) {
	if m.GetAllFunc != nil {
		return m.GetAllFunc(ctx, userID)
	}
	return nil, nil
}

func (m *MockCategoryRepo) Create(ctx context.Context, userID, name string, color models.Color) (*models.Category, error) {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, userID, name, color)
	}
	return nil, nil
}

func (m *MockCategoryRepo) UpdateName(ctx context.Context, id, userID, name string) (*models.Category, error) {
	if m.UpdateNameFunc != nil {
		return m.UpdateNameFunc(ctx, id, userID, name)
	}
	return nil, nil
}

func (m *MockCategoryRepo) Delete(ctx context.Context, id, userID string) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(ctx, id, userID)
	}
	return nil
}

func (m *MockCategoryRepo) BelongsToUser(ctx context.Context, id, userID string) (bool, error) {
	if m.BelongsToUserFunc != nil {
		return m.BelongsToUserFunc(ctx, id, userID)
	}
	return true, nil
}

func (m *MockCategoryRepo) Exists(ctx context.Context, id string) (bool, error) {
	if m.ExistsFunc != nil {
		return m.ExistsFunc(ctx, id)
	}
	return false, nil
}

func (m *MockCategoryRepo) Count(ctx context.Context, userID string) (int, error) {
	if m.CountFunc != nil {
		return m.CountFunc(ctx, userID)
	}
	return 0, nil
}

// MockPasswordResetRepo is a mock implementation of PasswordResetRepository for testing
type MockPasswordResetRepo struct {
	CreateFunc              func(ctx context.Context, userID, tokenHash string, expiresAt time.Time) (*models.PasswordResetToken, error)
	GetByTokenHashFunc      func(ctx context.Context, tokenHash string) (*models.PasswordResetToken, error)
	MarkUsedFunc            func(ctx context.Context, id string) error
	DeleteByUserIDFunc      func(ctx context.Context, userID string) error
	DeleteExpiredFunc       func(ctx context.Context) error
	CountRecentByUserIDFunc func(ctx context.Context, userID string, since time.Time) (int, error)
}

func (m *MockPasswordResetRepo) Create(ctx context.Context, userID, tokenHash string, expiresAt time.Time) (*models.PasswordResetToken, error) {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, userID, tokenHash, expiresAt)
	}
	return &models.PasswordResetToken{
		ID:        "reset-123",
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
	}, nil
}

func (m *MockPasswordResetRepo) GetByTokenHash(ctx context.Context, tokenHash string) (*models.PasswordResetToken, error) {
	if m.GetByTokenHashFunc != nil {
		return m.GetByTokenHashFunc(ctx, tokenHash)
	}
	return nil, repository.ErrResetTokenNotFound
}

func (m *MockPasswordResetRepo) MarkUsed(ctx context.Context, id string) error {
	if m.MarkUsedFunc != nil {
		return m.MarkUsedFunc(ctx, id)
	}
	return nil
}

func (m *MockPasswordResetRepo) DeleteByUserID(ctx context.Context, userID string) error {
	if m.DeleteByUserIDFunc != nil {
		return m.DeleteByUserIDFunc(ctx, userID)
	}
	return nil
}

func (m *MockPasswordResetRepo) DeleteExpired(ctx context.Context) error {
	if m.DeleteExpiredFunc != nil {
		return m.DeleteExpiredFunc(ctx)
	}
	return nil
}

func (m *MockPasswordResetRepo) CountRecentByUserID(ctx context.Context, userID string, since time.Time) (int, error) {
	if m.CountRecentByUserIDFunc != nil {
		return m.CountRecentByUserIDFunc(ctx, userID, since)
	}
	return 0, nil
}

// MockRefreshTokenRepo is a mock implementation of RefreshTokenRepository for testing
type MockRefreshTokenRepo struct {
	CreateFunc         func(ctx context.Context, userID, tokenHash string, expiresAt time.Time) (*models.RefreshToken, error)
	GetByTokenHashFunc func(ctx context.Context, tokenHash string) (*models.RefreshToken, error)
	MarkConsumedFunc   func(ctx context.Context, id string) error
	DeleteFunc         func(ctx context.Context, id string) error
	DeleteByUserIDFunc func(ctx context.Context, userID string) error
	DeleteExpiredFunc  func(ctx context.Context) error
	CountByUserIDFunc  func(ctx context.Context, userID string) (int, error)
}

func (m *MockRefreshTokenRepo) Create(ctx context.Context, userID, tokenHash string, expiresAt time.Time) (*models.RefreshToken, error) {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, userID, tokenHash, expiresAt)
	}
	return &models.RefreshToken{
		ID:        "refresh-123",
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
	}, nil
}

func (m *MockRefreshTokenRepo) GetByTokenHash(ctx context.Context, tokenHash string) (*models.RefreshToken, error) {
	if m.GetByTokenHashFunc != nil {
		return m.GetByTokenHashFunc(ctx, tokenHash)
	}
	return nil, repository.ErrRefreshTokenNotFound
}

func (m *MockRefreshTokenRepo) MarkConsumed(ctx context.Context, id string) error {
	if m.MarkConsumedFunc != nil {
		return m.MarkConsumedFunc(ctx, id)
	}
	return nil
}

func (m *MockRefreshTokenRepo) Delete(ctx context.Context, id string) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(ctx, id)
	}
	return nil
}

func (m *MockRefreshTokenRepo) DeleteByUserID(ctx context.Context, userID string) error {
	if m.DeleteByUserIDFunc != nil {
		return m.DeleteByUserIDFunc(ctx, userID)
	}
	return nil
}

func (m *MockRefreshTokenRepo) DeleteExpired(ctx context.Context) error {
	if m.DeleteExpiredFunc != nil {
		return m.DeleteExpiredFunc(ctx)
	}
	return nil
}

func (m *MockRefreshTokenRepo) CountByUserID(ctx context.Context, userID string) (int, error) {
	if m.CountByUserIDFunc != nil {
		return m.CountByUserIDFunc(ctx, userID)
	}
	return 0, nil
}

// MockOpeningExplorerCacheRepo is a mock implementation of
// OpeningExplorerCacheRepository for testing.
type MockOpeningExplorerCacheRepo struct {
	GetFunc           func(ctx context.Context, cacheKey string) ([]byte, bool, error)
	PutFunc           func(ctx context.Context, cacheKey string, payload []byte, expiresAt time.Time) error
	DeleteExpiredFunc func(ctx context.Context) error
}

func (m *MockOpeningExplorerCacheRepo) Get(ctx context.Context, cacheKey string) ([]byte, bool, error) {
	if m.GetFunc != nil {
		return m.GetFunc(ctx, cacheKey)
	}
	return nil, false, nil
}

func (m *MockOpeningExplorerCacheRepo) Put(ctx context.Context, cacheKey string, payload []byte, expiresAt time.Time) error {
	if m.PutFunc != nil {
		return m.PutFunc(ctx, cacheKey, payload, expiresAt)
	}
	return nil
}

func (m *MockOpeningExplorerCacheRepo) DeleteExpired(ctx context.Context) error {
	if m.DeleteExpiredFunc != nil {
		return m.DeleteExpiredFunc(ctx)
	}
	return nil
}
