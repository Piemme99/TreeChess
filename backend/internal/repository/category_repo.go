package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kumquat/backend/internal/models"
)

const (
	getCategoryByIDSQL = `
		SELECT id, name, color, created_at, updated_at
		FROM categories
		WHERE id = $1 AND user_id = $2
	`
	getCategoriesByUserAndColorSQL = `
		SELECT id, name, color, created_at, updated_at
		FROM categories
		WHERE user_id = $1 AND color = $2
		ORDER BY name ASC
	`
	getAllCategoriesByUserSQL = `
		SELECT id, name, color, created_at, updated_at
		FROM categories
		WHERE user_id = $1
		ORDER BY color, name ASC
	`
	createCategorySQL = `
		INSERT INTO categories (id, user_id, name, color)
		VALUES ($1, $2, $3, $4)
		RETURNING id, name, color, created_at, updated_at
	`
	updateCategoryNameSQL = `
		UPDATE categories
		SET name = $2, updated_at = NOW()
		WHERE id = $1 AND user_id = $3
		RETURNING id, name, color, created_at, updated_at
	`
	deleteCategorySQL = `
		DELETE FROM categories WHERE id = $1 AND user_id = $2
	`
	belongsToUserCategorySQL = `
		SELECT EXISTS(SELECT 1 FROM categories WHERE id = $1 AND user_id = $2)
	`
	checkCategoryExistsByIDSQL = `
		SELECT EXISTS(SELECT 1 FROM categories WHERE id = $1)
	`
	countCategoriesByUserSQL = `
		SELECT COUNT(*) FROM categories WHERE user_id = $1
	`
)

// CategoryRepository defines operations for categories
type CategoryRepository interface {
	GetByID(ctx context.Context, id, userID string) (*models.Category, error)
	GetByUserAndColor(ctx context.Context, userID string, color models.Color) ([]models.Category, error)
	GetAll(ctx context.Context, userID string) ([]models.Category, error)
	Create(ctx context.Context, userID, name string, color models.Color) (*models.Category, error)
	UpdateName(ctx context.Context, id, userID, name string) (*models.Category, error)
	Delete(ctx context.Context, id, userID string) error
	BelongsToUser(ctx context.Context, id, userID string) (bool, error)
	Exists(ctx context.Context, id string) (bool, error)
	Count(ctx context.Context, userID string) (int, error)
}

// PostgresCategoryRepo implements CategoryRepository using PostgreSQL.
//
// db is the executor every query runs against: normally the connection pool,
// or a pgx.Tx when the repo is bound to a transaction by a unit-of-work so a
// category Create participates in the same transaction as the repertoires it
// groups (see PostgresRepertoireRepo.WithinTx).
type PostgresCategoryRepo struct {
	db pgxExecutor
}

// NewPostgresCategoryRepo creates a new PostgreSQL category repository
func NewPostgresCategoryRepo(pool *pgxpool.Pool) *PostgresCategoryRepo {
	return &PostgresCategoryRepo{db: pool}
}

// newTxCategoryRepo creates a category repo bound to an open transaction. All of
// its queries run on tx so they participate in the surrounding unit-of-work.
func newTxCategoryRepo(tx pgxExecutor) *PostgresCategoryRepo {
	return &PostgresCategoryRepo{db: tx}
}

// GetByID retrieves a category by its UUID, scoped to the owning user
func (r *PostgresCategoryRepo) GetByID(ctx context.Context, id, userID string) (*models.Category, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	var cat models.Category
	err := r.db.QueryRow(ctx, getCategoryByIDSQL, id, userID).Scan(
		&cat.ID,
		&cat.Name,
		&cat.Color,
		&cat.CreatedAt,
		&cat.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCategoryNotFound
		}
		return nil, fmt.Errorf("failed to get category: %w", err)
	}

	return &cat, nil
}

// GetByUserAndColor retrieves all categories of a given color for a user
func (r *PostgresCategoryRepo) GetByUserAndColor(ctx context.Context, userID string, color models.Color) ([]models.Category, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	rows, err := r.db.Query(ctx, getCategoriesByUserAndColorSQL, userID, string(color))
	if err != nil {
		return nil, fmt.Errorf("failed to query categories: %w", err)
	}
	defer rows.Close()

	return r.scanCategories(rows)
}

// GetAll retrieves all categories for a user
func (r *PostgresCategoryRepo) GetAll(ctx context.Context, userID string) ([]models.Category, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	rows, err := r.db.Query(ctx, getAllCategoriesByUserSQL, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query categories: %w", err)
	}
	defer rows.Close()

	return r.scanCategories(rows)
}

// Create creates a new category for a user
func (r *PostgresCategoryRepo) Create(ctx context.Context, userID, name string, color models.Color) (*models.Category, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	id := uuid.New().String()
	var cat models.Category

	err := r.db.QueryRow(ctx, createCategorySQL, id, userID, name, string(color)).Scan(
		&cat.ID,
		&cat.Name,
		&cat.Color,
		&cat.CreatedAt,
		&cat.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create category: %w", err)
	}

	return &cat, nil
}

// UpdateName updates the name of a category, scoped to the owning user
func (r *PostgresCategoryRepo) UpdateName(ctx context.Context, id, userID, name string) (*models.Category, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	var cat models.Category
	err := r.db.QueryRow(ctx, updateCategoryNameSQL, id, name, userID).Scan(
		&cat.ID,
		&cat.Name,
		&cat.Color,
		&cat.CreatedAt,
		&cat.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCategoryNotFound
		}
		return nil, fmt.Errorf("failed to update category name: %w", err)
	}

	return &cat, nil
}

// Delete deletes a category by ID, scoped to the owning user (repertoires will cascade delete)
func (r *PostgresCategoryRepo) Delete(ctx context.Context, id, userID string) error {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	result, err := r.db.Exec(ctx, deleteCategorySQL, id, userID)
	if err != nil {
		return fmt.Errorf("failed to delete category: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrCategoryNotFound
	}

	return nil
}

// BelongsToUser checks if a category belongs to a specific user
func (r *PostgresCategoryRepo) BelongsToUser(ctx context.Context, id, userID string) (bool, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	var belongs bool
	err := r.db.QueryRow(ctx, belongsToUserCategorySQL, id, userID).Scan(&belongs)
	if err != nil {
		return false, fmt.Errorf("failed to check category ownership: %w", err)
	}
	return belongs, nil
}

// Exists checks if a category exists by ID
func (r *PostgresCategoryRepo) Exists(ctx context.Context, id string) (bool, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	var exists bool
	err := r.db.QueryRow(ctx, checkCategoryExistsByIDSQL, id).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check category existence: %w", err)
	}
	return exists, nil
}

// Count returns the total number of categories for a user
func (r *PostgresCategoryRepo) Count(ctx context.Context, userID string) (int, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	var count int
	err := r.db.QueryRow(ctx, countCategoriesByUserSQL, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count categories: %w", err)
	}
	return count, nil
}

// scanCategories is a helper to scan multiple category rows
func (r *PostgresCategoryRepo) scanCategories(rows interface {
	Next() bool
	Scan(...interface{}) error
	Err() error
}) ([]models.Category, error) {
	var categories []models.Category

	for rows.Next() {
		var cat models.Category
		err := rows.Scan(
			&cat.ID,
			&cat.Name,
			&cat.Color,
			&cat.CreatedAt,
			&cat.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan category: %w", err)
		}
		categories = append(categories, cat)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating categories: %w", err)
	}

	return categories, nil
}
