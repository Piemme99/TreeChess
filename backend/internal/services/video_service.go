package services

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	"github.com/treechess/backend/config"
	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/recognition"
	"github.com/treechess/backend/internal/repository"
)

var youtubeURLPattern = regexp.MustCompile(
	`^(?:https?://)?(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})`,
)

// CommandRunner abstracts external command execution for testability
type CommandRunner interface {
	// Run executes a command and returns combined stdout+stderr output
	Run(name string, args ...string) ([]byte, error)
	// Output executes a command and returns stdout only
	Output(name string, args ...string) ([]byte, error)
	// RunContext executes a command with context and returns combined stdout+stderr output
	RunContext(ctx context.Context, name string, args ...string) ([]byte, error)
	// OutputContext executes a command with context and returns stdout only
	OutputContext(ctx context.Context, name string, args ...string) ([]byte, error)
}

// Recognizer abstracts chess position recognition for testability
type Recognizer interface {
	RecognizeFrames(ctx context.Context, framesDir string, onProgress recognition.ProgressFunc) (*recognition.Result, error)
}

// gocvRecognizer is the real implementation using the recognition package
type gocvRecognizer struct{}

func (r *gocvRecognizer) RecognizeFrames(ctx context.Context, framesDir string, onProgress recognition.ProgressFunc) (*recognition.Result, error) {
	return recognition.RecognizeFrames(ctx, framesDir, onProgress)
}

// execCommandRunner is the real implementation using os/exec
type execCommandRunner struct{}

func (r *execCommandRunner) Run(name string, args ...string) ([]byte, error) {
	return exec.Command(name, args...).CombinedOutput()
}

func (r *execCommandRunner) Output(name string, args ...string) ([]byte, error) {
	return exec.Command(name, args...).Output()
}

func (r *execCommandRunner) RunContext(ctx context.Context, name string, args ...string) ([]byte, error) {
	return exec.CommandContext(ctx, name, args...).CombinedOutput()
}

func (r *execCommandRunner) OutputContext(ctx context.Context, name string, args ...string) ([]byte, error) {
	return exec.CommandContext(ctx, name, args...).Output()
}

// VideoService handles video import processing
type VideoService struct {
	repo       repository.VideoRepository
	cfg        config.Config
	treeSvc    *TreeBuilderService
	runner     CommandRunner
	recognizer Recognizer
	cancelFns  sync.Map // map[string]context.CancelFunc
}

// NewVideoService creates a new video service
func NewVideoService(repo repository.VideoRepository, cfg config.Config, treeSvc *TreeBuilderService) *VideoService {
	return &VideoService{
		repo:       repo,
		cfg:        cfg,
		treeSvc:    treeSvc,
		runner:     &execCommandRunner{},
		recognizer: &gocvRecognizer{},
	}
}

// NewVideoServiceWithDeps creates a video service with custom dependencies (for testing)
func NewVideoServiceWithDeps(repo repository.VideoRepository, cfg config.Config, treeSvc *TreeBuilderService, runner CommandRunner, recognizer Recognizer) *VideoService {
	return &VideoService{
		repo:       repo,
		cfg:        cfg,
		treeSvc:    treeSvc,
		runner:     runner,
		recognizer: recognizer,
	}
}

// ValidateYouTubeURL validates a YouTube URL and extracts the video ID
func ValidateYouTubeURL(url string) (string, error) {
	matches := youtubeURLPattern.FindStringSubmatch(url)
	if len(matches) < 2 {
		return "", fmt.Errorf("invalid YouTube URL")
	}
	return matches[1], nil
}

// SubmitImport validates and creates a new video import, returns the import and a progress channel
func (s *VideoService) SubmitImport(userID string, youtubeURL string) (*models.VideoImport, <-chan models.SSEProgressEvent, error) {
	videoID, err := ValidateYouTubeURL(youtubeURL)
	if err != nil {
		return nil, nil, err
	}

	vi, err := s.repo.CreateImport(userID, youtubeURL, videoID, "")
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create video import: %w", err)
	}

	progressCh := make(chan models.SSEProgressEvent, 100)

	ctx, cancel := context.WithCancel(context.Background())
	s.cancelFns.Store(vi.ID, cancel)

	go s.processVideo(ctx, vi.ID, youtubeURL, videoID, progressCh)

	return vi, progressCh, nil
}

// GetImport retrieves a video import by ID
func (s *VideoService) GetImport(id string) (*models.VideoImport, error) {
	return s.repo.GetImportByID(id)
}

// GetAllImports retrieves all video imports for a user
func (s *VideoService) GetAllImports(userID string) ([]models.VideoImport, error) {
	return s.repo.GetAllImports(userID)
}

// CancelImport cancels a running video import
func (s *VideoService) CancelImport(id string) error {
	vi, err := s.repo.GetImportByID(id)
	if err != nil {
		return err
	}

	// Don't cancel if already in a terminal state
	if vi.Status == models.VideoStatusCompleted || vi.Status == models.VideoStatusFailed || vi.Status == models.VideoStatusCancelled {
		return fmt.Errorf("import is already in terminal state: %s", vi.Status)
	}

	cancelFn, ok := s.cancelFns.Load(id)
	if !ok {
		return fmt.Errorf("no active processing found for import %s", id)
	}

	cancelFn.(context.CancelFunc)()
	return nil
}

// DeleteImport deletes a video import
func (s *VideoService) DeleteImport(id string) error {
	return s.repo.DeleteImport(id)
}

// GetPositions retrieves positions for a video import
func (s *VideoService) GetPositions(importID string) ([]models.VideoPosition, error) {
	return s.repo.GetPositionsByImportID(importID)
}

// GetTree builds a repertoire tree from the positions of a video import
func (s *VideoService) GetTree(importID string) (*models.RepertoireNode, models.Color, error) {
	positions, err := s.repo.GetPositionsByImportID(importID)
	if err != nil {
		return nil, "", err
	}

	if len(positions) == 0 {
		return nil, "", fmt.Errorf("no positions found for video import")
	}

	root, color, _, err := s.treeSvc.BuildTreeFromPositions(positions)
	return root, color, err
}

// SearchByFEN searches for video imports containing a specific FEN position for a user
func (s *VideoService) SearchByFEN(userID string, fen string) ([]models.VideoSearchResult, error) {
	return s.repo.SearchPositionsByFEN(userID, fen)
}

// CheckOwnership verifies that a video import belongs to the given user
func (s *VideoService) CheckOwnership(id string, userID string) error {
	belongs, err := s.repo.BelongsToUser(id, userID)
	if err != nil {
		return fmt.Errorf("failed to check ownership: %w", err)
	}
	if !belongs {
		return ErrNotFound
	}
	return nil
}

func (s *VideoService) processVideo(ctx context.Context, importID, youtubeURL, videoID string, progressCh chan<- models.SSEProgressEvent) {
	defer close(progressCh)
	defer s.cancelFns.Delete(importID)

	tmpDir := filepath.Join(os.TempDir(), fmt.Sprintf("treechess-video-%s", importID))
	defer os.RemoveAll(tmpDir)

	if err := os.MkdirAll(tmpDir, 0755); err != nil {
		s.failImport(importID, progressCh, fmt.Sprintf("failed to create temp directory: %v", err))
		return
	}

	// Step 1: Download video
	s.sendProgress(importID, progressCh, models.VideoStatusDownloading, 5, "Downloading video...")
	videoPath, title, err := s.downloadVideo(ctx, youtubeURL, tmpDir)
	if err != nil {
		if ctx.Err() != nil {
			s.cancelledImport(importID, progressCh)
			return
		}
		s.failImport(importID, progressCh, fmt.Sprintf("failed to download video: %v", err))
		return
	}

	// Update title in DB
	if title != "" {
		_ = s.repo.UpdateImportStatus(importID, models.VideoStatusDownloading, 10, nil)
	}

	// Check cancellation
	if ctx.Err() != nil {
		s.cancelledImport(importID, progressCh)
		return
	}

	// Step 2: Extract frames
	s.sendProgress(importID, progressCh, models.VideoStatusExtracting, 15, "Extracting frames...")
	framesDir := filepath.Join(tmpDir, "frames")
	if err := os.MkdirAll(framesDir, 0755); err != nil {
		s.failImport(importID, progressCh, fmt.Sprintf("failed to create frames directory: %v", err))
		return
	}

	err = s.extractFrames(ctx, videoPath, framesDir)
	if err != nil {
		if ctx.Err() != nil {
			s.cancelledImport(importID, progressCh)
			return
		}
		s.failImport(importID, progressCh, fmt.Sprintf("failed to extract frames: %v", err))
		return
	}

	// Check cancellation
	if ctx.Err() != nil {
		s.cancelledImport(importID, progressCh)
		return
	}

	// Step 3: Recognize positions
	s.sendProgress(importID, progressCh, models.VideoStatusRecognizing, 25, "Recognizing chess positions...")
	result, err := s.recognizePositions(ctx, importID, framesDir, progressCh)
	if err != nil {
		if ctx.Err() != nil {
			s.cancelledImport(importID, progressCh)
			return
		}
		s.failImport(importID, progressCh, fmt.Sprintf("failed to recognize positions: %v", err))
		return
	}

	// Check cancellation
	if ctx.Err() != nil {
		s.cancelledImport(importID, progressCh)
		return
	}

	// Step 4: Save positions to DB
	s.sendProgress(importID, progressCh, models.VideoStatusBuildingTree, 90, "Saving positions...")

	var dbPositions []models.VideoPosition
	for _, p := range result.Positions {
		if !p.BoardDetected {
			continue
		}
		dbPositions = append(dbPositions, models.VideoPosition{
			VideoImportID:    importID,
			FEN:              p.FEN,
			TimestampSeconds: p.TimestampSeconds,
			FrameIndex:       p.FrameIndex,
			Confidence:       &p.Confidence,
		})
	}

	if len(dbPositions) > 0 {
		if err := s.repo.SavePositions(dbPositions); err != nil {
			s.failImport(importID, progressCh, fmt.Sprintf("failed to save positions: %v", err))
			return
		}
	}

	// Step 5: Complete
	if err := s.repo.CompleteImport(importID); err != nil {
		s.failImport(importID, progressCh, fmt.Sprintf("failed to complete import: %v", err))
		return
	}

	s.sendProgress(importID, progressCh, models.VideoStatusCompleted, 100,
		fmt.Sprintf("Completed! Found %d positions with chess boards.", len(dbPositions)))
}

func (s *VideoService) downloadVideo(ctx context.Context, youtubeURL, tmpDir string) (string, string, error) {
	// Step 1: Fetch title separately
	titleOut, _ := s.runner.OutputContext(ctx, s.cfg.YtdlpPath,
		"--no-playlist",
		"--print", "%(title)s",
		"--no-warnings",
		"--skip-download",
		"--extractor-args", "youtube:player_client=mediaconnect",
		youtubeURL,
	)
	title := strings.TrimSpace(string(titleOut))

	// Step 2: Download the video
	outputPath := filepath.Join(tmpDir, "video.mp4")
	output, err := s.runner.RunContext(ctx, s.cfg.YtdlpPath,
		"--no-playlist",
		"--format", "worst[ext=mp4][protocol=https]/worstvideo[ext=mp4][protocol=https]+worstaudio[protocol=https]/worst[protocol=https]",
		"--merge-output-format", "mp4",
		"--extractor-args", "youtube:player_client=mediaconnect",
		"--output", outputPath,
		"--no-warnings",
		youtubeURL,
	)
	if err != nil {
		return "", "", fmt.Errorf("yt-dlp failed: %s", string(output))
	}

	// Verify file exists, with fallback directory scan
	videoPath, findErr := findDownloadedVideo(tmpDir, outputPath)
	if findErr != nil {
		return "", "", findErr
	}

	return videoPath, title, nil
}

// findDownloadedVideo checks for the expected video file, falling back to scanning
// the directory for any file yt-dlp may have created with a different name/extension.
func findDownloadedVideo(tmpDir, expectedPath string) (string, error) {
	if _, err := os.Stat(expectedPath); err == nil {
		return expectedPath, nil
	}

	// Fallback: scan directory for any file
	entries, err := os.ReadDir(tmpDir)
	if err != nil {
		return "", fmt.Errorf("downloaded video file not found and cannot read dir: %w", err)
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			return filepath.Join(tmpDir, entry.Name()), nil
		}
	}
	return "", fmt.Errorf("downloaded video file not found in %s", tmpDir)
}

func (s *VideoService) extractFrames(ctx context.Context, videoPath, framesDir string) error {
	output, err := s.runner.RunContext(ctx, s.cfg.FfmpegPath,
		"-i", videoPath,
		"-vf", "fps=1",
		"-q:v", "2",
		filepath.Join(framesDir, "frame_%06d.png"),
	)
	if err != nil {
		return fmt.Errorf("ffmpeg failed: %s", string(output))
	}

	return nil
}

func (s *VideoService) recognizePositions(ctx context.Context, importID, framesDir string, progressCh chan<- models.SSEProgressEvent) (*recognition.Result, error) {
	onProgress := func(processedFrames, totalFrames int) {
		pct := 25 + int(float64(processedFrames)/float64(totalFrames)*60)
		if pct > 85 {
			pct = 85
		}

		_ = s.repo.UpdateImportFrames(importID, totalFrames, processedFrames)

		msg := fmt.Sprintf("Frame %d/%d", processedFrames, totalFrames)
		s.sendProgress(importID, progressCh, models.VideoStatusRecognizing, pct, msg)
	}

	result, err := s.recognizer.RecognizeFrames(ctx, framesDir, onProgress)
	if err != nil {
		return nil, fmt.Errorf("recognition failed: %w", err)
	}

	return result, nil
}

func (s *VideoService) sendProgress(importID string, progressCh chan<- models.SSEProgressEvent, status models.VideoImportStatus, progress int, message string) {
	_ = s.repo.UpdateImportStatus(importID, status, progress, nil)

	event := models.SSEProgressEvent{
		Status:   status,
		Progress: progress,
		Message:  message,
	}

	select {
	case progressCh <- event:
	default:
		// Channel full, skip
	}
}

func (s *VideoService) cancelledImport(importID string, progressCh chan<- models.SSEProgressEvent) {
	log.Printf("Video import %s cancelled", importID)

	_ = s.repo.UpdateImportStatus(importID, models.VideoStatusCancelled, 0, nil)

	event := models.SSEProgressEvent{
		Status:   models.VideoStatusCancelled,
		Progress: 0,
		Message:  "Import cancelled",
	}

	select {
	case progressCh <- event:
	default:
	}
}

func (s *VideoService) failImport(importID string, progressCh chan<- models.SSEProgressEvent, errMsg string) {
	log.Printf("Video import %s failed: %s", importID, errMsg)

	_ = s.repo.UpdateImportStatus(importID, models.VideoStatusFailed, 0, &errMsg)

	event := models.SSEProgressEvent{
		Status:   models.VideoStatusFailed,
		Progress: 0,
		Message:  errMsg,
	}

	select {
	case progressCh <- event:
	default:
	}
}
