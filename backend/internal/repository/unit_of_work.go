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
	Create(ctx context.Context, userID string, name string, color models.Color) (*models.Repertoire, error)
	CreateWithCategory(ctx context.Context, userID string, name string, color models.Color, categoryID *string) (*models.Repertoire, error)
	Save(ctx context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error)
	UpdateOrigin(ctx context.Context, id string, userID string, origin *models.RepertoireOrigin) error
	Delete(ctx context.Context, id string, userID string) error
	// CreateCategory creates a category in the same transaction so study import
	// never leaves an orphan category behind a failed repertoire write.
	CreateCategory(ctx context.Context, userID, name string, color models.Color) (*models.Category, error)
}

// txRepertoireRepo binds the repertoire and category repositories to one
// transaction and exposes them through the RepertoireTx surface.
type txRepertoireRepo struct {
	repo     *PostgresRepertoireRepo
	category *PostgresCategoryRepo
}

func (t *txRepertoireRepo) Create(ctx context.Context, userID string, name string, color models.Color) (*models.Repertoire, error) {
	return t.repo.Create(ctx, userID, name, color)
}

func (t *txRepertoireRepo) CreateWithCategory(ctx context.Context, userID string, name string, color models.Color, categoryID *string) (*models.Repertoire, error) {
	return t.repo.CreateWithCategory(ctx, userID, name, color, categoryID)
}

func (t *txRepertoireRepo) Save(ctx context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error) {
	return t.repo.Save(ctx, id, userID, treeData, metadata, expectedVersion)
}

func (t *txRepertoireRepo) UpdateOrigin(ctx context.Context, id string, userID string, origin *models.RepertoireOrigin) error {
	return t.repo.UpdateOrigin(ctx, id, userID, origin)
}

func (t *txRepertoireRepo) Delete(ctx context.Context, id string, userID string) error {
	return t.repo.Delete(ctx, id, userID)
}

func (t *txRepertoireRepo) CreateCategory(ctx context.Context, userID, name string, color models.Color) (*models.Category, error) {
	return t.category.Create(ctx, userID, name, color)
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
