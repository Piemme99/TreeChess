package repository

import (
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresFingerprintRepo implements GameFingerprintRepository using PostgreSQL
type PostgresFingerprintRepo struct {
	pool *pgxpool.Pool
}

// NewPostgresFingerprintRepo creates a new PostgreSQL fingerprint repository
func NewPostgresFingerprintRepo(pool *pgxpool.Pool) *PostgresFingerprintRepo {
	return &PostgresFingerprintRepo{pool: pool}
}

// CheckExisting returns which fingerprints already exist for the given user
func (r *PostgresFingerprintRepo) CheckExisting(userID string, fingerprints []string) (map[string]bool, error) {
	if len(fingerprints) == 0 {
		return map[string]bool{}, nil
	}

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
		return nil, fmt.Errorf("failed to check existing fingerprints: %w", err)
	}
	defer rows.Close()

	existing := make(map[string]bool)
	for rows.Next() {
		var fp string
		if err := rows.Scan(&fp); err != nil {
			return nil, fmt.Errorf("failed to scan fingerprint: %w", err)
		}
		existing[fp] = true
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating fingerprints: %w", err)
	}

	return existing, nil
}

// SaveBatch inserts multiple fingerprints in a single query
func (r *PostgresFingerprintRepo) SaveBatch(userID, analysisID string, entries []FingerprintEntry) error {
	if len(entries) == 0 {
		return nil
	}

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

// DeleteByAnalysisAndIndex deletes a fingerprint for a specific game in an analysis
func (r *PostgresFingerprintRepo) DeleteByAnalysisAndIndex(analysisID string, gameIndex int) error {
	ctx, cancel := dbContext()
	defer cancel()

	_, err := r.pool.Exec(ctx,
		"DELETE FROM game_fingerprints WHERE analysis_id = $1 AND game_index = $2",
		analysisID, gameIndex,
	)
	if err != nil {
		return fmt.Errorf("failed to delete fingerprint: %w", err)
	}

	return nil
}
