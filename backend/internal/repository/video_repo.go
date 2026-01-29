package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/treechess/backend/internal/models"
)

const (
	createVideoImportSQL = `
		INSERT INTO video_imports (id, user_id, youtube_url, youtube_id, title, status, progress)
		VALUES ($1, $2, $3, $4, $5, 'pending', 0)
		RETURNING id, youtube_url, youtube_id, title, status, progress, error_message,
		          total_frames, processed_frames, created_at, completed_at
	`
	getVideoImportByIDSQL = `
		SELECT id, youtube_url, youtube_id, title, status, progress, error_message,
		       total_frames, processed_frames, created_at, completed_at
		FROM video_imports
		WHERE id = $1
	`
	getAllVideoImportsSQL = `
		SELECT id, youtube_url, youtube_id, title, status, progress, error_message,
		       total_frames, processed_frames, created_at, completed_at
		FROM video_imports
		WHERE user_id = $1
		ORDER BY created_at DESC
	`
	updateVideoImportStatusSQL = `
		UPDATE video_imports
		SET status = $2, progress = $3, error_message = $4
		WHERE id = $1
	`
	updateVideoImportFramesSQL = `
		UPDATE video_imports
		SET total_frames = $2, processed_frames = $3
		WHERE id = $1
	`
	completeVideoImportSQL = `
		UPDATE video_imports
		SET status = 'completed', progress = 100, completed_at = NOW()
		WHERE id = $1
	`
	deleteVideoImportSQL = `
		DELETE FROM video_imports WHERE id = $1
	`
	saveVideoPositionSQL = `
		INSERT INTO video_positions (id, video_import_id, fen, timestamp_seconds, frame_index, confidence)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	getVideoPositionsByImportIDSQL = `
		SELECT id, video_import_id, fen, timestamp_seconds, frame_index, confidence, created_at
		FROM video_positions
		WHERE video_import_id = $1
		ORDER BY frame_index ASC
	`
	searchVideoPositionsByFENSQL = `
		SELECT vp.id, vp.video_import_id, vp.fen, vp.timestamp_seconds, vp.frame_index, vp.confidence, vp.created_at,
		       vi.id, vi.youtube_url, vi.youtube_id, vi.title, vi.status, vi.progress, vi.error_message,
		       vi.total_frames, vi.processed_frames, vi.created_at, vi.completed_at
		FROM video_positions vp
		JOIN video_imports vi ON vp.video_import_id = vi.id
		WHERE vi.user_id = $1 AND vp.fen = $2 AND vi.status = 'completed'
		ORDER BY vi.created_at DESC, vp.timestamp_seconds ASC
	`
	belongsToUserVideoSQL = `
		SELECT EXISTS(SELECT 1 FROM video_imports WHERE id = $1 AND user_id = $2)
	`
)

// PostgresVideoRepo implements VideoRepository using PostgreSQL
type PostgresVideoRepo struct {
	pool *pgxpool.Pool
}

// NewPostgresVideoRepo creates a new PostgreSQL video repository
func NewPostgresVideoRepo(pool *pgxpool.Pool) *PostgresVideoRepo {
	return &PostgresVideoRepo{pool: pool}
}

// CreateImport creates a new video import record for a user
func (r *PostgresVideoRepo) CreateImport(userID string, youtubeURL, youtubeID, title string) (*models.VideoImport, error) {
	ctx, cancel := dbContext()
	defer cancel()

	id := uuid.New().String()
	var vi models.VideoImport

	err := r.pool.QueryRow(ctx, createVideoImportSQL, id, userID, youtubeURL, youtubeID, title).Scan(
		&vi.ID,
		&vi.YouTubeURL,
		&vi.YouTubeID,
		&vi.Title,
		&vi.Status,
		&vi.Progress,
		&vi.ErrorMessage,
		&vi.TotalFrames,
		&vi.ProcessedFrames,
		&vi.CreatedAt,
		&vi.CompletedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create video import: %w", err)
	}

	return &vi, nil
}

// GetImportByID retrieves a video import by ID
func (r *PostgresVideoRepo) GetImportByID(id string) (*models.VideoImport, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var vi models.VideoImport
	err := r.pool.QueryRow(ctx, getVideoImportByIDSQL, id).Scan(
		&vi.ID,
		&vi.YouTubeURL,
		&vi.YouTubeID,
		&vi.Title,
		&vi.Status,
		&vi.Progress,
		&vi.ErrorMessage,
		&vi.TotalFrames,
		&vi.ProcessedFrames,
		&vi.CreatedAt,
		&vi.CompletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrVideoImportNotFound
		}
		return nil, fmt.Errorf("failed to get video import: %w", err)
	}

	return &vi, nil
}

// GetAllImports retrieves all video imports for a user
func (r *PostgresVideoRepo) GetAllImports(userID string) ([]models.VideoImport, error) {
	ctx, cancel := dbContext()
	defer cancel()

	rows, err := r.pool.Query(ctx, getAllVideoImportsSQL, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query video imports: %w", err)
	}
	defer rows.Close()

	var imports []models.VideoImport
	for rows.Next() {
		var vi models.VideoImport
		err := rows.Scan(
			&vi.ID,
			&vi.YouTubeURL,
			&vi.YouTubeID,
			&vi.Title,
			&vi.Status,
			&vi.Progress,
			&vi.ErrorMessage,
			&vi.TotalFrames,
			&vi.ProcessedFrames,
			&vi.CreatedAt,
			&vi.CompletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan video import: %w", err)
		}
		imports = append(imports, vi)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating video imports: %w", err)
	}

	return imports, nil
}

// UpdateImportStatus updates the status and progress of a video import
func (r *PostgresVideoRepo) UpdateImportStatus(id string, status models.VideoImportStatus, progress int, errorMsg *string) error {
	ctx, cancel := dbContext()
	defer cancel()

	result, err := r.pool.Exec(ctx, updateVideoImportStatusSQL, id, string(status), progress, errorMsg)
	if err != nil {
		return fmt.Errorf("failed to update video import status: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrVideoImportNotFound
	}

	return nil
}

// UpdateImportFrames updates the frame counts of a video import
func (r *PostgresVideoRepo) UpdateImportFrames(id string, totalFrames, processedFrames int) error {
	ctx, cancel := dbContext()
	defer cancel()

	result, err := r.pool.Exec(ctx, updateVideoImportFramesSQL, id, totalFrames, processedFrames)
	if err != nil {
		return fmt.Errorf("failed to update video import frames: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrVideoImportNotFound
	}

	return nil
}

// CompleteImport marks a video import as completed
func (r *PostgresVideoRepo) CompleteImport(id string) error {
	ctx, cancel := dbContext()
	defer cancel()

	result, err := r.pool.Exec(ctx, completeVideoImportSQL, id)
	if err != nil {
		return fmt.Errorf("failed to complete video import: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrVideoImportNotFound
	}

	return nil
}

// DeleteImport deletes a video import and its positions (cascade)
func (r *PostgresVideoRepo) DeleteImport(id string) error {
	ctx, cancel := dbContext()
	defer cancel()

	result, err := r.pool.Exec(ctx, deleteVideoImportSQL, id)
	if err != nil {
		return fmt.Errorf("failed to delete video import: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrVideoImportNotFound
	}

	return nil
}

// SavePositions saves a batch of video positions
func (r *PostgresVideoRepo) SavePositions(positions []models.VideoPosition) error {
	ctx, cancel := context60s()
	defer cancel()

	batch := &pgx.Batch{}
	for _, pos := range positions {
		id := uuid.New().String()
		batch.Queue(saveVideoPositionSQL, id, pos.VideoImportID, pos.FEN, pos.TimestampSeconds, pos.FrameIndex, pos.Confidence)
	}

	br := r.pool.SendBatch(ctx, batch)
	defer br.Close()

	for range positions {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("failed to save video position: %w", err)
		}
	}

	return nil
}

// GetPositionsByImportID retrieves all positions for a video import
func (r *PostgresVideoRepo) GetPositionsByImportID(importID string) ([]models.VideoPosition, error) {
	ctx, cancel := dbContext()
	defer cancel()

	rows, err := r.pool.Query(ctx, getVideoPositionsByImportIDSQL, importID)
	if err != nil {
		return nil, fmt.Errorf("failed to query video positions: %w", err)
	}
	defer rows.Close()

	var positions []models.VideoPosition
	for rows.Next() {
		var vp models.VideoPosition
		err := rows.Scan(
			&vp.ID,
			&vp.VideoImportID,
			&vp.FEN,
			&vp.TimestampSeconds,
			&vp.FrameIndex,
			&vp.Confidence,
			&vp.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan video position: %w", err)
		}
		positions = append(positions, vp)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating video positions: %w", err)
	}

	return positions, nil
}

// SearchPositionsByFEN finds all video imports containing a given FEN position for a user
func (r *PostgresVideoRepo) SearchPositionsByFEN(userID string, fen string) ([]models.VideoSearchResult, error) {
	ctx, cancel := dbContext()
	defer cancel()

	rows, err := r.pool.Query(ctx, searchVideoPositionsByFENSQL, userID, fen)
	if err != nil {
		return nil, fmt.Errorf("failed to search video positions: %w", err)
	}
	defer rows.Close()

	resultMap := make(map[string]*models.VideoSearchResult)
	var order []string

	for rows.Next() {
		var vp models.VideoPosition
		var vi models.VideoImport

		err := rows.Scan(
			&vp.ID, &vp.VideoImportID, &vp.FEN, &vp.TimestampSeconds,
			&vp.FrameIndex, &vp.Confidence, &vp.CreatedAt,
			&vi.ID, &vi.YouTubeURL, &vi.YouTubeID, &vi.Title, &vi.Status,
			&vi.Progress, &vi.ErrorMessage, &vi.TotalFrames, &vi.ProcessedFrames,
			&vi.CreatedAt, &vi.CompletedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan video search result: %w", err)
		}

		if _, exists := resultMap[vi.ID]; !exists {
			resultMap[vi.ID] = &models.VideoSearchResult{
				VideoImport: vi,
				Positions:   []models.VideoPosition{},
			}
			order = append(order, vi.ID)
		}
		resultMap[vi.ID].Positions = append(resultMap[vi.ID].Positions, vp)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating video search results: %w", err)
	}

	var results []models.VideoSearchResult
	for _, id := range order {
		results = append(results, *resultMap[id])
	}

	return results, nil
}

// BelongsToUser checks if a video import belongs to a specific user
func (r *PostgresVideoRepo) BelongsToUser(id string, userID string) (bool, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var belongs bool
	err := r.pool.QueryRow(ctx, belongsToUserVideoSQL, id, userID).Scan(&belongs)
	if err != nil {
		return false, fmt.Errorf("failed to check video import ownership: %w", err)
	}
	return belongs, nil
}

// context60s creates a context with 60s timeout for batch operations
func context60s() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 60*time.Second)
}
