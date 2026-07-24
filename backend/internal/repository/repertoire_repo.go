package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kumquat/backend/internal/models"
)

const (
	getRepertoireByIDSQL = `
		SELECT id, name, description, color, is_public, category_id, tree_data, metadata, origin_type, origin_url, origin_creator, created_at, updated_at, version
		FROM repertoires
		WHERE id = $1 AND user_id = $2
	`
	getRepertoiresByColorSQL = `
		SELECT id, name, description, color, is_public, category_id, tree_data, metadata, origin_type, origin_url, origin_creator, created_at, updated_at, version
		FROM repertoires
		WHERE user_id = $1 AND color = $2
		ORDER BY updated_at DESC
	`
	getAllRepertoiresSQL = `
		SELECT id, name, description, color, is_public, category_id, tree_data, metadata, origin_type, origin_url, origin_creator, created_at, updated_at, version
		FROM repertoires
		WHERE user_id = $1
		ORDER BY color, updated_at DESC
	`
	getRepertoiresByCategorySQL = `
		SELECT id, name, description, color, is_public, category_id, tree_data, metadata, origin_type, origin_url, origin_creator, created_at, updated_at, version
		FROM repertoires
		WHERE category_id = $1
		ORDER BY updated_at DESC
	`
	getUncategorizedRepertoiresSQL = `
		SELECT id, name, description, color, is_public, category_id, tree_data, metadata, origin_type, origin_url, origin_creator, created_at, updated_at, version
		FROM repertoires
		WHERE user_id = $1 AND color = $2 AND category_id IS NULL
		ORDER BY updated_at DESC
	`
	createRepertoireSQL = `
		INSERT INTO repertoires (id, user_id, name, description, color, is_public, tree_data, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, name, description, color, is_public, category_id, tree_data, metadata, origin_type, origin_url, origin_creator, created_at, updated_at, version
	`
	createRepertoireWithCategorySQL = `
		INSERT INTO repertoires (id, user_id, name, description, color, is_public, category_id, tree_data, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, name, description, color, is_public, category_id, tree_data, metadata, origin_type, origin_url, origin_creator, created_at, updated_at, version
	`
	// updateRepertoireByIDSQL is the optimistic-locked tree write. The
	// "AND version = $5" guard makes the UPDATE a no-op (zero rows, surfaced as
	// pgx.ErrNoRows on the RETURNING) when the caller's snapshot is stale, and
	// "version = version + 1" bumps the counter on every successful write.
	updateRepertoireByIDSQL = `
		UPDATE repertoires
		SET tree_data = $2, metadata = $3, version = version + 1, updated_at = NOW()
		WHERE id = $1 AND user_id = $4 AND version = $5
		RETURNING id, name, description, color, is_public, category_id, tree_data, metadata, origin_type, origin_url, origin_creator, created_at, updated_at, version
	`
	updateRepertoireNameSQL = `
		UPDATE repertoires
		SET name = $2, updated_at = NOW()
		WHERE id = $1 AND user_id = $3
		RETURNING id, name, description, color, is_public, category_id, tree_data, metadata, origin_type, origin_url, origin_creator, created_at, updated_at, version
	`
	updateRepertoireDescriptionSQL = `
		UPDATE repertoires
		SET description = $2, updated_at = NOW()
		WHERE id = $1 AND user_id = $3
		RETURNING id, name, description, color, is_public, category_id, tree_data, metadata, origin_type, origin_url, origin_creator, created_at, updated_at, version
	`
	updateRepertoireCategorySQL = `
		UPDATE repertoires
		SET category_id = $2, updated_at = NOW()
		WHERE id = $1 AND user_id = $3
		RETURNING id, name, description, color, is_public, category_id, tree_data, metadata, origin_type, origin_url, origin_creator, created_at, updated_at, version
	`
	updateRepertoireVisibilitySQL = `
		UPDATE repertoires
		SET is_public = $2, updated_at = NOW()
		WHERE id = $1 AND user_id = $3
		RETURNING id, name, description, color, is_public, category_id, tree_data, metadata, origin_type, origin_url, origin_creator, created_at, updated_at, version
	`
	updateRepertoireOriginSQL = `
		UPDATE repertoires
		SET origin_type = $2, origin_url = $3, origin_creator = $4
		WHERE id = $1 AND user_id = $5
	`
	getAllPublicRepertoiresSQL = `
		SELECT r.id, r.name, r.description, r.color, r.is_public, NULL AS category_id, r.tree_data, r.metadata, r.origin_type, r.origin_url, r.origin_creator, r.created_at, r.updated_at, r.version,
		       u.username
		FROM repertoires r
		JOIN users u ON r.user_id = u.id
		WHERE r.is_public = true
		ORDER BY r.updated_at DESC
	`
	getPublicRepertoireByIDSQL = `
		SELECT r.id, r.name, r.description, r.color, r.is_public, NULL AS category_id, r.tree_data, r.metadata, r.origin_type, r.origin_url, r.origin_creator, r.created_at, r.updated_at, r.version,
		       u.username
		FROM repertoires r
		JOIN users u ON r.user_id = u.id
		WHERE r.id = $1 AND r.is_public = true
	`
	deleteRepertoireSQL = `
		DELETE FROM repertoires WHERE id = $1 AND user_id = $2
	`
	deleteDismissedGapsForRepertoireSQL = `
		DELETE FROM dismissed_gaps WHERE repertoire_id = $1 AND user_id = $2
	`
	countRepertoiresSQL = `
		SELECT COUNT(*) FROM repertoires WHERE user_id = $1
	`
	belongsToUserRepertoireSQL = `
		SELECT EXISTS(SELECT 1 FROM repertoires WHERE id = $1 AND user_id = $2)
	`
	checkRepertoireExistsByIDSQL = `
		SELECT EXISTS(SELECT 1 FROM repertoires WHERE id = $1)
	`
)

// PostgresRepertoireRepo implements RepertoireRepository using PostgreSQL.
//
// db is the executor every query runs against: normally the connection pool
// (each call auto-committed), or a pgx.Tx when the repo is bound to a
// transaction by a unit-of-work (see WithinTx). pool is only set on the
// pool-backed instance and is used by WithinTx to open transactions; tx-bound
// instances leave it nil.
type PostgresRepertoireRepo struct {
	db   pgxExecutor
	pool *pgxpool.Pool
}

// NewPostgresRepertoireRepo creates a new PostgreSQL repertoire repository
func NewPostgresRepertoireRepo(pool *pgxpool.Pool) *PostgresRepertoireRepo {
	return &PostgresRepertoireRepo{db: pool, pool: pool}
}

// buildOrigin constructs a RepertoireOrigin from nullable scan values, returning nil if no origin is set.
func buildOrigin(originType, originURL, originCreator *string) *models.RepertoireOrigin {
	if originType == nil {
		return nil
	}
	origin := &models.RepertoireOrigin{Type: *originType}
	if originURL != nil {
		origin.URL = *originURL
	}
	if originCreator != nil {
		origin.Creator = *originCreator
	}
	return origin
}

// GetByID retrieves a repertoire by its UUID, scoped to the owning user
func (r *PostgresRepertoireRepo) GetByID(ctx context.Context, id string, userID string) (*models.Repertoire, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	var rep models.Repertoire
	var treeDataJSON, metadataJSON []byte
	var originType, originURL, originCreator *string

	err := r.db.QueryRow(ctx, getRepertoireByIDSQL, id, userID).Scan(
		&rep.ID,
		&rep.Name,
		&rep.Description,
		&rep.Color,
		&rep.IsPublic,
		&rep.CategoryID,
		&treeDataJSON,
		&metadataJSON,
		&originType,
		&originURL,
		&originCreator,
		&rep.CreatedAt,
		&rep.UpdatedAt,
		&rep.Version,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRepertoireNotFound
		}
		return nil, fmt.Errorf("failed to get repertoire: %w", err)
	}

	if err := json.Unmarshal(treeDataJSON, &rep.TreeData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tree_data: %w", err)
	}

	if err := json.Unmarshal(metadataJSON, &rep.Metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	rep.Origin = buildOrigin(originType, originURL, originCreator)

	return &rep, nil
}

// GetByColor retrieves all repertoires of a given color for a user
func (r *PostgresRepertoireRepo) GetByColor(ctx context.Context, userID string, color models.Color) ([]models.Repertoire, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	rows, err := r.db.Query(ctx, getRepertoiresByColorSQL, userID, string(color))
	if err != nil {
		return nil, fmt.Errorf("failed to query repertoires: %w", err)
	}
	defer rows.Close()

	return r.scanRepertoires(rows)
}

// GetAll retrieves all repertoires for a user
func (r *PostgresRepertoireRepo) GetAll(ctx context.Context, userID string) ([]models.Repertoire, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	rows, err := r.db.Query(ctx, getAllRepertoiresSQL, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query repertoires: %w", err)
	}
	defer rows.Close()

	return r.scanRepertoires(rows)
}

// Create creates a new repertoire with a name and color for a user
func (r *PostgresRepertoireRepo) Create(ctx context.Context, userID string, name string, color models.Color) (*models.Repertoire, error) {
	return r.CreateWithCategory(ctx, userID, name, color, nil)
}

// CreateWithIsPublic creates a new repertoire with explicit visibility
func (r *PostgresRepertoireRepo) CreateWithIsPublic(ctx context.Context, userID string, name string, color models.Color, isPublic bool) (*models.Repertoire, error) {
	return r.createRepertoire(ctx, userID, name, "", color, nil, isPublic)
}

// CreateWithIsPublicAndDescription creates a new repertoire with explicit visibility and description
func (r *PostgresRepertoireRepo) CreateWithIsPublicAndDescription(ctx context.Context, userID string, name string, description string, color models.Color, isPublic bool) (*models.Repertoire, error) {
	return r.createRepertoire(ctx, userID, name, description, color, nil, isPublic)
}

// CreateWithCategory creates a new repertoire with a name, color, and optional category for a user
func (r *PostgresRepertoireRepo) CreateWithCategory(ctx context.Context, userID string, name string, color models.Color, categoryID *string) (*models.Repertoire, error) {
	return r.createRepertoire(ctx, userID, name, "", color, categoryID, false)
}

// createRepertoire is the internal implementation for creating repertoires
func (r *PostgresRepertoireRepo) createRepertoire(ctx context.Context, userID string, name string, description string, color models.Color, categoryID *string, isPublic bool) (*models.Repertoire, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	rootNode := models.RepertoireNode{
		ID:          uuid.New().String(),
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		MoveNumber:  0,
		ColorToMove: models.ChessColorWhite,
		ParentID:    nil,
		Children:    []*models.RepertoireNode{},
	}

	metadata := models.Metadata{
		TotalNodes:   1,
		TotalMoves:   0,
		DeepestDepth: 0,
	}

	treeDataJSON, err := json.Marshal(rootNode)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal tree_data: %w", err)
	}

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal metadata: %w", err)
	}

	rep := models.Repertoire{
		ID:          uuid.New().String(),
		Name:        name,
		Description: description,
		Color:       color,
		IsPublic:    isPublic,
		CategoryID:  categoryID,
		TreeData:    rootNode,
		Metadata:    metadata,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	var query string
	var args []interface{}

	if categoryID != nil {
		query = createRepertoireWithCategorySQL
		args = []interface{}{rep.ID, userID, rep.Name, rep.Description, string(rep.Color), isPublic, *categoryID, treeDataJSON, metadataJSON}
	} else {
		query = createRepertoireSQL
		args = []interface{}{rep.ID, userID, rep.Name, rep.Description, string(rep.Color), isPublic, treeDataJSON, metadataJSON}
	}

	var originType, originURL, originCreator *string
	err = r.db.QueryRow(ctx, query, args...).Scan(
		&rep.ID,
		&rep.Name,
		&rep.Description,
		&rep.Color,
		&rep.IsPublic,
		&rep.CategoryID,
		&treeDataJSON,
		&metadataJSON,
		&originType,
		&originURL,
		&originCreator,
		&rep.CreatedAt,
		&rep.UpdatedAt,
		&rep.Version,
	)
	if err != nil {
		if isRepertoireNameConflict(err) {
			return nil, ErrRepertoireNameExists
		}
		return nil, fmt.Errorf("failed to create repertoire: %w", err)
	}

	if err := json.Unmarshal(treeDataJSON, &rep.TreeData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tree_data: %w", err)
	}

	if err := json.Unmarshal(metadataJSON, &rep.Metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	rep.Origin = buildOrigin(originType, originURL, originCreator)

	return &rep, nil
}

// Save persists tree data and metadata for a repertoire by ID, scoped to user,
// under optimistic locking. expectedVersion must match the persisted version
// (the value loaded by the GetByID that produced treeData). On success the
// version is bumped and the refreshed repertoire is returned.
//
// When the conditional UPDATE matches no row, Save disambiguates the cause: if
// the row exists, the caller's snapshot was stale and ErrRepertoireConflict is
// returned; otherwise the repertoire is gone and ErrRepertoireNotFound is
// returned.
func (r *PostgresRepertoireRepo) Save(ctx context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	treeDataJSON, err := json.Marshal(treeData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal tree_data: %w", err)
	}

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal metadata: %w", err)
	}

	var rep models.Repertoire
	var newTreeDataJSON, newMetadataJSON []byte
	var originType, originURL, originCreator *string

	err = r.db.QueryRow(ctx, updateRepertoireByIDSQL,
		id,
		treeDataJSON,
		metadataJSON,
		userID,
		expectedVersion,
	).Scan(
		&rep.ID,
		&rep.Name,
		&rep.Description,
		&rep.Color,
		&rep.IsPublic,
		&rep.CategoryID,
		&newTreeDataJSON,
		&newMetadataJSON,
		&originType,
		&originURL,
		&originCreator,
		&rep.CreatedAt,
		&rep.UpdatedAt,
		&rep.Version,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			exists, existsErr := r.BelongsToUser(ctx, id, userID)
			if existsErr != nil {
				return nil, existsErr
			}
			if exists {
				return nil, ErrRepertoireConflict
			}
			return nil, ErrRepertoireNotFound
		}
		return nil, fmt.Errorf("failed to save repertoire: %w", err)
	}

	if err := json.Unmarshal(newTreeDataJSON, &rep.TreeData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tree_data: %w", err)
	}

	if err := json.Unmarshal(newMetadataJSON, &rep.Metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	rep.Origin = buildOrigin(originType, originURL, originCreator)

	return &rep, nil
}

// UpdateName updates the name of a repertoire, scoped to user
func (r *PostgresRepertoireRepo) UpdateName(ctx context.Context, id string, userID string, name string) (*models.Repertoire, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	var rep models.Repertoire
	var treeDataJSON, metadataJSON []byte
	var originType, originURL, originCreator *string

	err := r.db.QueryRow(ctx, updateRepertoireNameSQL, id, name, userID).Scan(
		&rep.ID,
		&rep.Name,
		&rep.Description,
		&rep.Color,
		&rep.IsPublic,
		&rep.CategoryID,
		&treeDataJSON,
		&metadataJSON,
		&originType,
		&originURL,
		&originCreator,
		&rep.CreatedAt,
		&rep.UpdatedAt,
		&rep.Version,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRepertoireNotFound
		}
		return nil, fmt.Errorf("failed to update repertoire name: %w", err)
	}

	if err := json.Unmarshal(treeDataJSON, &rep.TreeData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tree_data: %w", err)
	}

	if err := json.Unmarshal(metadataJSON, &rep.Metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	rep.Origin = buildOrigin(originType, originURL, originCreator)

	return &rep, nil
}

// UpdateDescription updates the description of a repertoire, scoped to user
func (r *PostgresRepertoireRepo) UpdateDescription(ctx context.Context, id string, userID string, description string) (*models.Repertoire, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	var rep models.Repertoire
	var treeDataJSON, metadataJSON []byte
	var originType, originURL, originCreator *string

	err := r.db.QueryRow(ctx, updateRepertoireDescriptionSQL, id, description, userID).Scan(
		&rep.ID,
		&rep.Name,
		&rep.Description,
		&rep.Color,
		&rep.IsPublic,
		&rep.CategoryID,
		&treeDataJSON,
		&metadataJSON,
		&originType,
		&originURL,
		&originCreator,
		&rep.CreatedAt,
		&rep.UpdatedAt,
		&rep.Version,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRepertoireNotFound
		}
		return nil, fmt.Errorf("failed to update repertoire description: %w", err)
	}

	if err := json.Unmarshal(treeDataJSON, &rep.TreeData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tree_data: %w", err)
	}

	if err := json.Unmarshal(metadataJSON, &rep.Metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	rep.Origin = buildOrigin(originType, originURL, originCreator)

	return &rep, nil
}

// UpdateCategory updates the category of a repertoire, scoped to user
func (r *PostgresRepertoireRepo) UpdateCategory(ctx context.Context, id string, userID string, categoryID *string) (*models.Repertoire, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	var rep models.Repertoire
	var treeDataJSON, metadataJSON []byte
	var originType, originURL, originCreator *string

	err := r.db.QueryRow(ctx, updateRepertoireCategorySQL, id, categoryID, userID).Scan(
		&rep.ID,
		&rep.Name,
		&rep.Description,
		&rep.Color,
		&rep.IsPublic,
		&rep.CategoryID,
		&treeDataJSON,
		&metadataJSON,
		&originType,
		&originURL,
		&originCreator,
		&rep.CreatedAt,
		&rep.UpdatedAt,
		&rep.Version,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRepertoireNotFound
		}
		return nil, fmt.Errorf("failed to update repertoire category: %w", err)
	}

	if err := json.Unmarshal(treeDataJSON, &rep.TreeData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tree_data: %w", err)
	}

	if err := json.Unmarshal(metadataJSON, &rep.Metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	rep.Origin = buildOrigin(originType, originURL, originCreator)

	return &rep, nil
}

// GetByCategory retrieves all repertoires in a specific category
func (r *PostgresRepertoireRepo) GetByCategory(ctx context.Context, categoryID string) ([]models.Repertoire, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	rows, err := r.db.Query(ctx, getRepertoiresByCategorySQL, categoryID)
	if err != nil {
		return nil, fmt.Errorf("failed to query repertoires by category: %w", err)
	}
	defer rows.Close()

	return r.scanRepertoires(rows)
}

// GetUncategorized retrieves all repertoires without a category for a user and color
func (r *PostgresRepertoireRepo) GetUncategorized(ctx context.Context, userID string, color models.Color) ([]models.Repertoire, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	rows, err := r.db.Query(ctx, getUncategorizedRepertoiresSQL, userID, string(color))
	if err != nil {
		return nil, fmt.Errorf("failed to query uncategorized repertoires: %w", err)
	}
	defer rows.Close()

	return r.scanRepertoires(rows)
}

// Delete deletes a repertoire by ID, scoped to user
func (r *PostgresRepertoireRepo) Delete(ctx context.Context, id string, userID string) error {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	result, err := r.db.Exec(ctx, deleteRepertoireSQL, id, userID)
	if err != nil {
		return fmt.Errorf("failed to delete repertoire: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrRepertoireNotFound
	}

	// dismissed_gaps has no FK to repertoires, so rows referencing the deleted
	// repertoire must be cleaned up explicitly or they accumulate forever.
	if _, err := r.db.Exec(ctx, deleteDismissedGapsForRepertoireSQL, id, userID); err != nil {
		return fmt.Errorf("failed to delete dismissed gaps for repertoire: %w", err)
	}

	return nil
}

// Count returns the total number of repertoires for a user
func (r *PostgresRepertoireRepo) Count(ctx context.Context, userID string) (int, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	var count int
	err := r.db.QueryRow(ctx, countRepertoiresSQL, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count repertoires: %w", err)
	}

	return count, nil
}

// Exists checks if a repertoire exists by ID
func (r *PostgresRepertoireRepo) Exists(ctx context.Context, id string) (bool, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	var exists bool
	err := r.db.QueryRow(ctx, checkRepertoireExistsByIDSQL, id).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check repertoire existence: %w", err)
	}
	return exists, nil
}

// BelongsToUser checks if a repertoire belongs to a specific user
func (r *PostgresRepertoireRepo) BelongsToUser(ctx context.Context, id string, userID string) (bool, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	var belongs bool
	err := r.db.QueryRow(ctx, belongsToUserRepertoireSQL, id, userID).Scan(&belongs)
	if err != nil {
		return false, fmt.Errorf("failed to check repertoire ownership: %w", err)
	}
	return belongs, nil
}

// scanRepertoires is a helper to scan multiple repertoire rows
// isRepertoireNameConflict detects a Postgres unique-constraint violation on the
// repertoires (user_id, name, color) tuple. It unwraps to the structured
// *pgconn.PgError and branches on the SQLSTATE code (23505 = unique_violation) plus
// the offending table name, rather than matching on (locale-dependent) error text.
// Restricting to the repertoires table prevents other unique constraints
// (categories, etc.) from being misclassified as a repertoire name conflict.
func isRepertoireNameConflict(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == pgUniqueViolation && pgErr.TableName == "repertoires"
	}
	return false
}

func (r *PostgresRepertoireRepo) scanRepertoires(rows interface {
	Next() bool
	Scan(...interface{}) error
	Err() error
}) ([]models.Repertoire, error) {
	var repertoires []models.Repertoire

	for rows.Next() {
		var rep models.Repertoire
		var treeDataJSON, metadataJSON []byte
		var originType, originURL, originCreator *string

		err := rows.Scan(
			&rep.ID,
			&rep.Name,
			&rep.Description,
			&rep.Color,
			&rep.IsPublic,
			&rep.CategoryID,
			&treeDataJSON,
			&metadataJSON,
			&originType,
			&originURL,
			&originCreator,
			&rep.CreatedAt,
			&rep.UpdatedAt,
			&rep.Version,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan repertoire: %w", err)
		}

		if err := json.Unmarshal(treeDataJSON, &rep.TreeData); err != nil {
			return nil, fmt.Errorf("failed to unmarshal tree_data: %w", err)
		}

		if err := json.Unmarshal(metadataJSON, &rep.Metadata); err != nil {
			return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
		}

		rep.Origin = buildOrigin(originType, originURL, originCreator)
		repertoires = append(repertoires, rep)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating repertoires: %w", err)
	}

	return repertoires, nil
}

// UpdateVisibility updates the is_public flag of a repertoire, scoped to user
func (r *PostgresRepertoireRepo) UpdateVisibility(ctx context.Context, id string, userID string, isPublic bool) (*models.Repertoire, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	var rep models.Repertoire
	var treeDataJSON, metadataJSON []byte
	var originType, originURL, originCreator *string

	err := r.db.QueryRow(ctx, updateRepertoireVisibilitySQL, id, isPublic, userID).Scan(
		&rep.ID,
		&rep.Name,
		&rep.Description,
		&rep.Color,
		&rep.IsPublic,
		&rep.CategoryID,
		&treeDataJSON,
		&metadataJSON,
		&originType,
		&originURL,
		&originCreator,
		&rep.CreatedAt,
		&rep.UpdatedAt,
		&rep.Version,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRepertoireNotFound
		}
		return nil, fmt.Errorf("failed to update repertoire visibility: %w", err)
	}

	if err := json.Unmarshal(treeDataJSON, &rep.TreeData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tree_data: %w", err)
	}

	if err := json.Unmarshal(metadataJSON, &rep.Metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	rep.Origin = buildOrigin(originType, originURL, originCreator)

	return &rep, nil
}

// UpdateOrigin sets the origin fields on a repertoire, scoped to the owning user
func (r *PostgresRepertoireRepo) UpdateOrigin(ctx context.Context, id string, userID string, origin *models.RepertoireOrigin) error {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	var originType, originURL, originCreator *string
	if origin != nil {
		originType = &origin.Type
		if origin.URL != "" {
			originURL = &origin.URL
		}
		if origin.Creator != "" {
			originCreator = &origin.Creator
		}
	}

	result, err := r.db.Exec(ctx, updateRepertoireOriginSQL, id, originType, originURL, originCreator, userID)
	if err != nil {
		return fmt.Errorf("failed to update repertoire origin: %w", err)
	}
	if result.RowsAffected() == 0 {
		return ErrRepertoireNotFound
	}
	return nil
}

// GetAllPublic retrieves all public repertoires with author usernames
func (r *PostgresRepertoireRepo) GetAllPublic(ctx context.Context) ([]models.Repertoire, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	rows, err := r.db.Query(ctx, getAllPublicRepertoiresSQL)
	if err != nil {
		return nil, fmt.Errorf("failed to query public repertoires: %w", err)
	}
	defer rows.Close()

	return r.scanRepertoiresWithAuthor(rows)
}

// GetPublicByID retrieves a single public repertoire by ID with author username
func (r *PostgresRepertoireRepo) GetPublicByID(ctx context.Context, id string) (*models.Repertoire, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	var rep models.Repertoire
	var treeDataJSON, metadataJSON []byte
	var originType, originURL, originCreator *string

	err := r.db.QueryRow(ctx, getPublicRepertoireByIDSQL, id).Scan(
		&rep.ID,
		&rep.Name,
		&rep.Description,
		&rep.Color,
		&rep.IsPublic,
		&rep.CategoryID,
		&treeDataJSON,
		&metadataJSON,
		&originType,
		&originURL,
		&originCreator,
		&rep.CreatedAt,
		&rep.UpdatedAt,
		&rep.Version,
		&rep.AuthorName,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRepertoireNotFound
		}
		return nil, fmt.Errorf("failed to get public repertoire: %w", err)
	}

	if err := json.Unmarshal(treeDataJSON, &rep.TreeData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tree_data: %w", err)
	}

	if err := json.Unmarshal(metadataJSON, &rep.Metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	rep.Origin = buildOrigin(originType, originURL, originCreator)

	return &rep, nil
}

// GetOwnerID returns the user_id of a repertoire
func (r *PostgresRepertoireRepo) GetOwnerID(ctx context.Context, id string) (string, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	var ownerID string
	err := r.db.QueryRow(ctx, `SELECT user_id FROM repertoires WHERE id = $1`, id).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrRepertoireNotFound
		}
		return "", fmt.Errorf("failed to get repertoire owner: %w", err)
	}
	return ownerID, nil
}

// scanRepertoiresWithAuthor scans repertoire rows that include a username column
func (r *PostgresRepertoireRepo) scanRepertoiresWithAuthor(rows interface {
	Next() bool
	Scan(...interface{}) error
	Err() error
}) ([]models.Repertoire, error) {
	var repertoires []models.Repertoire

	for rows.Next() {
		var rep models.Repertoire
		var treeDataJSON, metadataJSON []byte
		var originType, originURL, originCreator *string

		err := rows.Scan(
			&rep.ID,
			&rep.Name,
			&rep.Description,
			&rep.Color,
			&rep.IsPublic,
			&rep.CategoryID,
			&treeDataJSON,
			&metadataJSON,
			&originType,
			&originURL,
			&originCreator,
			&rep.CreatedAt,
			&rep.UpdatedAt,
			&rep.Version,
			&rep.AuthorName,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan repertoire: %w", err)
		}

		if err := json.Unmarshal(treeDataJSON, &rep.TreeData); err != nil {
			return nil, fmt.Errorf("failed to unmarshal tree_data: %w", err)
		}

		if err := json.Unmarshal(metadataJSON, &rep.Metadata); err != nil {
			return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
		}

		rep.Origin = buildOrigin(originType, originURL, originCreator)
		repertoires = append(repertoires, rep)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating repertoires: %w", err)
	}

	return repertoires, nil
}
