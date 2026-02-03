package repository

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/treechess/backend/internal/models"
)

const (
	getRepertoireByIDSQL = `
		SELECT id, name, color, category_id, tree_data, metadata, created_at, updated_at
		FROM repertoires
		WHERE id = $1
	`
	getRepertoiresByColorSQL = `
		SELECT id, name, color, category_id, tree_data, metadata, created_at, updated_at
		FROM repertoires
		WHERE user_id = $1 AND color = $2
		ORDER BY updated_at DESC
	`
	getAllRepertoiresSQL = `
		SELECT id, name, color, category_id, tree_data, metadata, created_at, updated_at
		FROM repertoires
		WHERE user_id = $1
		ORDER BY color, updated_at DESC
	`
	getRepertoiresByCategorySQL = `
		SELECT id, name, color, category_id, tree_data, metadata, created_at, updated_at
		FROM repertoires
		WHERE category_id = $1
		ORDER BY updated_at DESC
	`
	getUncategorizedRepertoiresSQL = `
		SELECT id, name, color, category_id, tree_data, metadata, created_at, updated_at
		FROM repertoires
		WHERE user_id = $1 AND color = $2 AND category_id IS NULL
		ORDER BY updated_at DESC
	`
	createRepertoireSQL = `
		INSERT INTO repertoires (id, user_id, name, color, tree_data, metadata)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, name, color, category_id, tree_data, metadata, created_at, updated_at
	`
	createRepertoireWithCategorySQL = `
		INSERT INTO repertoires (id, user_id, name, color, category_id, tree_data, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, name, color, category_id, tree_data, metadata, created_at, updated_at
	`
	updateRepertoireByIDSQL = `
		UPDATE repertoires
		SET tree_data = $2, metadata = $3, updated_at = NOW()
		WHERE id = $1
		RETURNING id, name, color, category_id, tree_data, metadata, created_at, updated_at
	`
	updateRepertoireNameSQL = `
		UPDATE repertoires
		SET name = $2, updated_at = NOW()
		WHERE id = $1
		RETURNING id, name, color, category_id, tree_data, metadata, created_at, updated_at
	`
	updateRepertoireCategorySQL = `
		UPDATE repertoires
		SET category_id = $2, updated_at = NOW()
		WHERE id = $1
		RETURNING id, name, color, category_id, tree_data, metadata, created_at, updated_at
	`
	deleteRepertoireSQL = `
		DELETE FROM repertoires WHERE id = $1
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

// PostgresRepertoireRepo implements RepertoireRepository using PostgreSQL
type PostgresRepertoireRepo struct {
	pool *pgxpool.Pool
}

// NewPostgresRepertoireRepo creates a new PostgreSQL repertoire repository
func NewPostgresRepertoireRepo(pool *pgxpool.Pool) *PostgresRepertoireRepo {
	return &PostgresRepertoireRepo{pool: pool}
}

// GetByID retrieves a repertoire by its UUID
func (r *PostgresRepertoireRepo) GetByID(id string) (*models.Repertoire, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var rep models.Repertoire
	var treeDataJSON, metadataJSON []byte

	err := r.pool.QueryRow(ctx, getRepertoireByIDSQL, id).Scan(
		&rep.ID,
		&rep.Name,
		&rep.Color,
		&rep.CategoryID,
		&treeDataJSON,
		&metadataJSON,
		&rep.CreatedAt,
		&rep.UpdatedAt,
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

	return &rep, nil
}

// GetByColor retrieves all repertoires of a given color for a user
func (r *PostgresRepertoireRepo) GetByColor(userID string, color models.Color) ([]models.Repertoire, error) {
	ctx, cancel := dbContext()
	defer cancel()

	rows, err := r.pool.Query(ctx, getRepertoiresByColorSQL, userID, string(color))
	if err != nil {
		return nil, fmt.Errorf("failed to query repertoires: %w", err)
	}
	defer rows.Close()

	return r.scanRepertoires(rows)
}

// GetAll retrieves all repertoires for a user
func (r *PostgresRepertoireRepo) GetAll(userID string) ([]models.Repertoire, error) {
	ctx, cancel := dbContext()
	defer cancel()

	rows, err := r.pool.Query(ctx, getAllRepertoiresSQL, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query repertoires: %w", err)
	}
	defer rows.Close()

	return r.scanRepertoires(rows)
}

// Create creates a new repertoire with a name and color for a user
func (r *PostgresRepertoireRepo) Create(userID string, name string, color models.Color) (*models.Repertoire, error) {
	return r.CreateWithCategory(userID, name, color, nil)
}

// CreateWithCategory creates a new repertoire with a name, color, and optional category for a user
func (r *PostgresRepertoireRepo) CreateWithCategory(userID string, name string, color models.Color, categoryID *string) (*models.Repertoire, error) {
	ctx, cancel := dbContext()
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
		ID:         uuid.New().String(),
		Name:       name,
		Color:      color,
		CategoryID: categoryID,
		TreeData:   rootNode,
		Metadata:   metadata,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	var query string
	var args []interface{}

	if categoryID != nil {
		query = createRepertoireWithCategorySQL
		args = []interface{}{rep.ID, userID, rep.Name, string(rep.Color), *categoryID, treeDataJSON, metadataJSON}
	} else {
		query = createRepertoireSQL
		args = []interface{}{rep.ID, userID, rep.Name, string(rep.Color), treeDataJSON, metadataJSON}
	}

	err = r.pool.QueryRow(ctx, query, args...).Scan(
		&rep.ID,
		&rep.Name,
		&rep.Color,
		&rep.CategoryID,
		&treeDataJSON,
		&metadataJSON,
		&rep.CreatedAt,
		&rep.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create repertoire: %w", err)
	}

	if err := json.Unmarshal(treeDataJSON, &rep.TreeData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tree_data: %w", err)
	}

	if err := json.Unmarshal(metadataJSON, &rep.Metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	return &rep, nil
}

// Save saves tree data and metadata for a repertoire by ID
func (r *PostgresRepertoireRepo) Save(id string, treeData models.RepertoireNode, metadata models.Metadata) (*models.Repertoire, error) {
	ctx, cancel := dbContext()
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

	err = r.pool.QueryRow(ctx, updateRepertoireByIDSQL,
		id,
		treeDataJSON,
		metadataJSON,
	).Scan(
		&rep.ID,
		&rep.Name,
		&rep.Color,
		&rep.CategoryID,
		&newTreeDataJSON,
		&newMetadataJSON,
		&rep.CreatedAt,
		&rep.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to save repertoire: %w", err)
	}

	if err := json.Unmarshal(newTreeDataJSON, &rep.TreeData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tree_data: %w", err)
	}

	if err := json.Unmarshal(newMetadataJSON, &rep.Metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	return &rep, nil
}

// UpdateName updates the name of a repertoire
func (r *PostgresRepertoireRepo) UpdateName(id string, name string) (*models.Repertoire, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var rep models.Repertoire
	var treeDataJSON, metadataJSON []byte

	err := r.pool.QueryRow(ctx, updateRepertoireNameSQL, id, name).Scan(
		&rep.ID,
		&rep.Name,
		&rep.Color,
		&rep.CategoryID,
		&treeDataJSON,
		&metadataJSON,
		&rep.CreatedAt,
		&rep.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update repertoire name: %w", err)
	}

	if err := json.Unmarshal(treeDataJSON, &rep.TreeData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tree_data: %w", err)
	}

	if err := json.Unmarshal(metadataJSON, &rep.Metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	return &rep, nil
}

// UpdateCategory updates the category of a repertoire
func (r *PostgresRepertoireRepo) UpdateCategory(id string, categoryID *string) (*models.Repertoire, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var rep models.Repertoire
	var treeDataJSON, metadataJSON []byte

	err := r.pool.QueryRow(ctx, updateRepertoireCategorySQL, id, categoryID).Scan(
		&rep.ID,
		&rep.Name,
		&rep.Color,
		&rep.CategoryID,
		&treeDataJSON,
		&metadataJSON,
		&rep.CreatedAt,
		&rep.UpdatedAt,
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

	return &rep, nil
}

// GetByCategory retrieves all repertoires in a specific category
func (r *PostgresRepertoireRepo) GetByCategory(categoryID string) ([]models.Repertoire, error) {
	ctx, cancel := dbContext()
	defer cancel()

	rows, err := r.pool.Query(ctx, getRepertoiresByCategorySQL, categoryID)
	if err != nil {
		return nil, fmt.Errorf("failed to query repertoires by category: %w", err)
	}
	defer rows.Close()

	return r.scanRepertoires(rows)
}

// GetUncategorized retrieves all repertoires without a category for a user and color
func (r *PostgresRepertoireRepo) GetUncategorized(userID string, color models.Color) ([]models.Repertoire, error) {
	ctx, cancel := dbContext()
	defer cancel()

	rows, err := r.pool.Query(ctx, getUncategorizedRepertoiresSQL, userID, string(color))
	if err != nil {
		return nil, fmt.Errorf("failed to query uncategorized repertoires: %w", err)
	}
	defer rows.Close()

	return r.scanRepertoires(rows)
}

// Delete deletes a repertoire by ID
func (r *PostgresRepertoireRepo) Delete(id string) error {
	ctx, cancel := dbContext()
	defer cancel()

	result, err := r.pool.Exec(ctx, deleteRepertoireSQL, id)
	if err != nil {
		return fmt.Errorf("failed to delete repertoire: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrRepertoireNotFound
	}

	return nil
}

// Count returns the total number of repertoires for a user
func (r *PostgresRepertoireRepo) Count(userID string) (int, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var count int
	err := r.pool.QueryRow(ctx, countRepertoiresSQL, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count repertoires: %w", err)
	}

	return count, nil
}

// Exists checks if a repertoire exists by ID
func (r *PostgresRepertoireRepo) Exists(id string) (bool, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var exists bool
	err := r.pool.QueryRow(ctx, checkRepertoireExistsByIDSQL, id).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check repertoire existence: %w", err)
	}
	return exists, nil
}

// BelongsToUser checks if a repertoire belongs to a specific user
func (r *PostgresRepertoireRepo) BelongsToUser(id string, userID string) (bool, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var belongs bool
	err := r.pool.QueryRow(ctx, belongsToUserRepertoireSQL, id, userID).Scan(&belongs)
	if err != nil {
		return false, fmt.Errorf("failed to check repertoire ownership: %w", err)
	}
	return belongs, nil
}

// scanRepertoires is a helper to scan multiple repertoire rows
func (r *PostgresRepertoireRepo) scanRepertoires(rows interface {
	Next() bool
	Scan(...interface{}) error
	Err() error
}) ([]models.Repertoire, error) {
	var repertoires []models.Repertoire

	for rows.Next() {
		var rep models.Repertoire
		var treeDataJSON, metadataJSON []byte

		err := rows.Scan(
			&rep.ID,
			&rep.Name,
			&rep.Color,
			&rep.CategoryID,
			&treeDataJSON,
			&metadataJSON,
			&rep.CreatedAt,
			&rep.UpdatedAt,
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

		repertoires = append(repertoires, rep)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating repertoires: %w", err)
	}

	return repertoires, nil
}
