package repository

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// pgxExecutor is the common subset of query methods shared by *pgxpool.Pool and
// pgx.Tx. Repository methods run against this interface so the exact same query
// logic can execute either on the connection pool (auto-committed) or inside an
// explicit transaction without duplicating SQL.
type pgxExecutor interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}
