package repository

import (
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kumquat/backend/config"
)

// PostgresFingerprintRepo implements GameFingerprintRepository using PostgreSQL
type PostgresFingerprintRepo struct {
	pool *pgxpool.Pool
}

// NewPostgresFingerprintRepo creates a new PostgreSQL fingerprint repository
func NewPostgresFingerprintRepo(pool *pgxpool.Pool) *PostgresFingerprintRepo {
	return &PostgresFingerprintRepo{pool: pool}
}

// CheckExisting returns which fingerprints already exist for the given user.
// The lookup is chunked into batches of config.DBBatchSize so that a large
// import never exceeds Postgres's 65535-parameter limit.
func (r *PostgresFingerprintRepo) CheckExisting(userID string, fingerprints []string) (map[string]bool, error) {
	existing := make(map[string]bool)
	if len(fingerprints) == 0 {
		return existing, nil
	}

	for start := 0; start < len(fingerprints); start += config.DBBatchSize {
		end := start + config.DBBatchSize
		if end > len(fingerprints) {
			end = len(fingerprints)
		}
		if err := r.checkExistingChunk(userID, fingerprints[start:end], existing); err != nil {
			return nil, err
		}
	}

	return existing, nil
}

// checkExistingChunk runs a single IN-clause lookup for one chunk of
// fingerprints and records any matches into the provided map.
func (r *PostgresFingerprintRepo) checkExistingChunk(userID string, fingerprints []string, existing map[string]bool) error {
	ctx, cancel := dbContext()
	defer cancel()

	// Build parameterized query for IN clause
	params := make([]interface{}, 0, len(fingerprints)+1)
	params = append(params, userID)
	placeholders := make([]string, len(fingerprints))
	for i, fp := range fingerprints {
		params = append(params, fp)
		placeholders[i] = fmt.Sprintf("$%d", i+2)
	}

	query := fmt.Sprintf(
		"SELECT fingerprint FROM game_fingerprints WHERE user_id = $1 AND fingerprint IN (%s)",
		strings.Join(placeholders, ", "),
	)

	rows, err := r.pool.Query(ctx, query, params...)
	if err != nil {
		return fmt.Errorf("failed to check existing fingerprints: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var fp string
		if err := rows.Scan(&fp); err != nil {
			return fmt.Errorf("failed to scan fingerprint: %w", err)
		}
		existing[fp] = true
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("error iterating fingerprints: %w", err)
	}

	return nil
}

// SaveBatch inserts multiple fingerprints, chunked into batches of
// config.DBBatchSize so that a large import never exceeds Postgres's
// 65535-parameter limit (4 parameters per row).
func (r *PostgresFingerprintRepo) SaveBatch(userID, analysisID string, entries []FingerprintEntry) error {
	if len(entries) == 0 {
		return nil
	}

	for start := 0; start < len(entries); start += config.DBBatchSize {
		end := start + config.DBBatchSize
		if end > len(entries) {
			end = len(entries)
		}
		if err := r.saveBatchChunk(userID, analysisID, entries[start:end]); err != nil {
			return err
		}
	}

	return nil
}

// saveBatchChunk inserts a single chunk of fingerprint entries in one query.
func (r *PostgresFingerprintRepo) saveBatchChunk(userID, analysisID string, entries []FingerprintEntry) error {
	ctx, cancel := dbContext()
	defer cancel()

	// Build bulk insert
	params := make([]interface{}, 0, len(entries)*4)
	valueClauses := make([]string, len(entries))
	for i, e := range entries {
		base := i * 4
		params = append(params, userID, e.Fingerprint, analysisID, e.GameIndex)
		valueClauses[i] = fmt.Sprintf("($%d, $%d, $%d, $%d)", base+1, base+2, base+3, base+4)
	}

	query := fmt.Sprintf(
		"INSERT INTO game_fingerprints (user_id, fingerprint, analysis_id, game_index) VALUES %s ON CONFLICT (user_id, fingerprint) DO NOTHING",
		strings.Join(valueClauses, ", "),
	)

	_, err := r.pool.Exec(ctx, query, params...)
	if err != nil {
		return fmt.Errorf("failed to save fingerprints: %w", err)
	}

	return nil
}
