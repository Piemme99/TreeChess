package repository

import (
	"context"
	"fmt"

	"github.com/kumquat/backend/internal/models"
)

// RepertoireTx is the set of mutations a unit-of-work closure may run inside a
// single transaction. The receiver methods mirror the pool-backed repository
// but execute on the surrounding pgx.Tx, so they commit or roll back together.
//
// Only the operations needed by the multi-step flows (merge, extract, study
// import) are exposed. Read methods such as GetByID are intentionally kept off
// this surface: callers gather the data they need before opening the
// transaction, keeping the transaction short and the lock window small.
type RepertoireTx interface {
	Create(userID string, name string, color models.Color) (*models.Repertoire, error)
	CreateWithCategory(userID string, name string, color models.Color, categoryID *string) (*models.Repertoire, error)
	Save(id string, userID string, treeData models.RepertoireNode, metadata models.Metadata) (*models.Repertoire, error)
	UpdateOrigin(id string, origin *models.RepertoireOrigin) error
	Delete(id string, userID string) error
	// CreateCategory creates a category in the same transaction so study import
	// never leaves an orphan category behind a failed repertoire write.
	CreateCategory(userID, name string, color models.Color) (*models.Category, error)
}

// txRepertoireRepo binds the repertoire and category repositories to one
// transaction and exposes them through the RepertoireTx surface.
type txRepertoireRepo struct {
	repo     *PostgresRepertoireRepo
	category *PostgresCategoryRepo
}

func (t *txRepertoireRepo) Create(userID string, name string, color models.Color) (*models.Repertoire, error) {
	return t.repo.Create(userID, name, color)
}

func (t *txRepertoireRepo) CreateWithCategory(userID string, name string, color models.Color, categoryID *string) (*models.Repertoire, error) {
	return t.repo.CreateWithCategory(userID, name, color, categoryID)
}

func (t *txRepertoireRepo) Save(id string, userID string, treeData models.RepertoireNode, metadata models.Metadata) (*models.Repertoire, error) {
	return t.repo.Save(id, userID, treeData, metadata)
}

func (t *txRepertoireRepo) UpdateOrigin(id string, origin *models.RepertoireOrigin) error {
	return t.repo.UpdateOrigin(id, origin)
}

func (t *txRepertoireRepo) Delete(id string, userID string) error {
	return t.repo.Delete(id, userID)
}

func (t *txRepertoireRepo) CreateCategory(userID, name string, color models.Color) (*models.Category, error) {
	return t.category.Create(userID, name, color)
}

// WithinTx runs fn inside a single database transaction. The closure receives a
// RepertoireTx whose mutations all execute on that transaction; the transaction
// commits when fn returns nil and rolls back (leaving no partial state) when fn
// returns an error or panics.
//
// This mirrors the transaction shape already used by PostgresUserRepo.Delete:
// Begin -> deferred Rollback -> Commit. The deferred Rollback is a no-op after a
// successful Commit, so it is safe to always defer it.
func (r *PostgresRepertoireRepo) WithinTx(ctx context.Context, fn func(tx RepertoireTx) error) error {
	if r.pool == nil {
		return fmt.Errorf("WithinTx requires a pool-backed repository")
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	txRepo := &txRepertoireRepo{
		repo:     &PostgresRepertoireRepo{db: tx},
		category: newTxCategoryRepo(tx),
	}

	if err := fn(txRepo); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
