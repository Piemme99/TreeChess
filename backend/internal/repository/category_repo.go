package repository

import (
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/treechess/backend/internal/models"
)

const (
	getCategoryByIDSQL = `
		SELECT id, name, color, created_at, updated_at
		FROM categories
		WHERE id = $1
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
		WHERE id = $1
		RETURNING id, name, color, created_at, updated_at
	`
	deleteCategorySQL = `
		DELETE FROM categories WHERE id = $1
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
	GetByID(id string) (*models.Category, error)
	GetByUserAndColor(userID string, color models.Color) ([]models.Category, error)
	GetAll(userID string) ([]models.Category, error)
	Create(userID, name string, color models.Color) (*models.Category, error)
	UpdateName(id, name string) (*models.Category, error)
	Delete(id string) error
	BelongsToUser(id, userID string) (bool, error)
	Exists(id string) (bool, error)
	Count(userID string) (int, error)
}

// PostgresCategoryRepo implements CategoryRepository using PostgreSQL
type PostgresCategoryRepo struct {
	pool *pgxpool.Pool
}

// NewPostgresCategoryRepo creates a new PostgreSQL category repository
func NewPostgresCategoryRepo(pool *pgxpool.Pool) *PostgresCategoryRepo {
	return &PostgresCategoryRepo{pool: pool}
}

// GetByID retrieves a category by its UUID
func (r *PostgresCategoryRepo) GetByID(id string) (*models.Category, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var cat models.Category
	err := r.pool.QueryRow(ctx, getCategoryByIDSQL, id).Scan(
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
func (r *PostgresCategoryRepo) GetByUserAndColor(userID string, color models.Color) ([]models.Category, error) {
	ctx, cancel := dbContext()
	defer cancel()

	rows, err := r.pool.Query(ctx, getCategoriesByUserAndColorSQL, userID, string(color))
	if err != nil {
		return nil, fmt.Errorf("failed to query categories: %w", err)
	}
	defer rows.Close()

	return r.scanCategories(rows)
}

// GetAll retrieves all categories for a user
func (r *PostgresCategoryRepo) GetAll(userID string) ([]models.Category, error) {
	ctx, cancel := dbContext()
	defer cancel()

	rows, err := r.pool.Query(ctx, getAllCategoriesByUserSQL, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query categories: %w", err)
	}
	defer rows.Close()

	return r.scanCategories(rows)
}

// Create creates a new category for a user
func (r *PostgresCategoryRepo) Create(userID, name string, color models.Color) (*models.Category, error) {
	ctx, cancel := dbContext()
	defer cancel()

	id := uuid.New().String()
	var cat models.Category

	err := r.pool.QueryRow(ctx, createCategorySQL, id, userID, name, string(color)).Scan(
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

// UpdateName updates the name of a category
func (r *PostgresCategoryRepo) UpdateName(id, name string) (*models.Category, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var cat models.Category
	err := r.pool.QueryRow(ctx, updateCategoryNameSQL, id, name).Scan(
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

// Delete deletes a category by ID (repertoires will cascade delete)
func (r *PostgresCategoryRepo) Delete(id string) error {
	ctx, cancel := dbContext()
	defer cancel()

	result, err := r.pool.Exec(ctx, deleteCategorySQL, id)
	if err != nil {
		return fmt.Errorf("failed to delete category: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrCategoryNotFound
	}

	return nil
}

// BelongsToUser checks if a category belongs to a specific user
func (r *PostgresCategoryRepo) BelongsToUser(id, userID string) (bool, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var belongs bool
	err := r.pool.QueryRow(ctx, belongsToUserCategorySQL, id, userID).Scan(&belongs)
	if err != nil {
		return false, fmt.Errorf("failed to check category ownership: %w", err)
	}
	return belongs, nil
}

// Exists checks if a category exists by ID
func (r *PostgresCategoryRepo) Exists(id string) (bool, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var exists bool
	err := r.pool.QueryRow(ctx, checkCategoryExistsByIDSQL, id).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check category existence: %w", err)
	}
	return exists, nil
}

// Count returns the total number of categories for a user
func (r *PostgresCategoryRepo) Count(userID string) (int, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var count int
	err := r.pool.QueryRow(ctx, countCategoriesByUserSQL, userID).Scan(&count)
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
