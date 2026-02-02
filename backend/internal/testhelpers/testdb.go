//go:build integration

package testhelpers

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/treechess/backend/config"
	"github.com/treechess/backend/internal/repository"
)

// Repos holds all real repository implementations for integration tests.
type Repos struct {
	User        *repository.PostgresUserRepo
	Repertoire  *repository.PostgresRepertoireRepo
	Analysis    *repository.PostgresAnalysisRepo
	Fingerprint *repository.PostgresFingerprintRepo
	EngineEval  *repository.PostgresEngineEvalRepo
}

// TestDB wraps a testcontainer PostgreSQL instance with a connection pool and repos.
type TestDB struct {
	Container testcontainers.Container
	Pool      *pgxpool.Pool
	DB        *repository.DB
	repos     *Repos
}

// SetupTestDB launches a PostgreSQL container, runs migrations, and returns a TestDB.
// It uses t.Fatal on error, so it's suitable for use in individual test functions.
func SetupTestDB(t *testing.T) *TestDB {
	t.Helper()
	tdb, err := setupTestDB()
	if err != nil {
		t.Fatalf("SetupTestDB: %v", err)
	}
	return tdb
}

// MustSetupTestDB launches a PostgreSQL container for use in TestMain.
// It panics on error instead of using t.Fatal.
func MustSetupTestDB() *TestDB {
	tdb, err := setupTestDB()
	if err != nil {
		panic(fmt.Sprintf("MustSetupTestDB: %v", err))
	}
	return tdb
}

func setupTestDB() (*TestDB, error) {
	ctx := context.Background()

	pgContainer, err := postgres.Run(ctx,
		"postgres:17-alpine",
		postgres.WithDatabase("treechess_test"),
		postgres.WithUsername("test"),
		postgres.WithPassword("test"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(30*time.Second),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("starting postgres container: %w", err)
	}

	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		_ = pgContainer.Terminate(ctx)
		return nil, fmt.Errorf("getting connection string: %w", err)
	}

	cfg := config.Config{
		DatabaseURL: connStr,
	}

	db, err := repository.NewDB(cfg)
	if err != nil {
		_ = pgContainer.Terminate(ctx)
		return nil, fmt.Errorf("initializing DB with migrations: %w", err)
	}

	return &TestDB{
		Container: pgContainer,
		Pool:      db.Pool,
		DB:        db,
	}, nil
}

// Teardown closes the pool and terminates the container.
func (tdb *TestDB) Teardown() {
	if tdb.Pool != nil {
		tdb.Pool.Close()
	}
	if tdb.Container != nil {
		_ = tdb.Container.Terminate(context.Background())
	}
}

// TruncateAll removes all data from all tables, preserving schema.
func (tdb *TestDB) TruncateAll(t *testing.T) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := tdb.Pool.Exec(ctx,
		`TRUNCATE TABLE engine_evals, viewed_games, game_fingerprints, analyses, repertoires, users CASCADE`)
	if err != nil {
		t.Fatalf("TruncateAll: %v", err)
	}
}

// Repos returns all real repositories wired to the test database pool.
func (tdb *TestDB) Repos() *Repos {
	if tdb.repos == nil {
		tdb.repos = &Repos{
			User:        repository.NewPostgresUserRepo(tdb.Pool),
			Repertoire:  repository.NewPostgresRepertoireRepo(tdb.Pool),
			Analysis:    repository.NewPostgresAnalysisRepo(tdb.Pool),
			Fingerprint: repository.NewPostgresFingerprintRepo(tdb.Pool),
			EngineEval:  repository.NewPostgresEngineEvalRepo(tdb.Pool),
		}
	}
	return tdb.repos
}
