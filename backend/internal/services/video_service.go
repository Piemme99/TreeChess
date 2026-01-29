package services

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/treechess/backend/config"
	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
)

var youtubeURLPattern = regexp.MustCompile(
	`^(?:https?://)?(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})`,
)

// VideoService handles video import processing
type VideoService struct {
	repo       repository.VideoRepository
	cfg        config.Config
	treeSvc    *TreeBuilderService
}

// NewVideoService creates a new video service
func NewVideoService(repo repository.VideoRepository, cfg config.Config, treeSvc *TreeBuilderService) *VideoService {
	return &VideoService{
		repo:    repo,
		cfg:     cfg,
		treeSvc: treeSvc,
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
func (s *VideoService) SubmitImport(youtubeURL string) (*models.VideoImport, <-chan models.SSEProgressEvent, error) {
	videoID, err := ValidateYouTubeURL(youtubeURL)
	if err != nil {
		return nil, nil, err
	}

	vi, err := s.repo.CreateImport(youtubeURL, videoID, "")
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create video import: %w", err)
	}

	progressCh := make(chan models.SSEProgressEvent, 100)

	go s.processVideo(vi.ID, youtubeURL, videoID, progressCh)

	return vi, progressCh, nil
}

// GetImport retrieves a video import by ID
func (s *VideoService) GetImport(id string) (*models.VideoImport, error) {
	return s.repo.GetImportByID(id)
}

// GetAllImports retrieves all video imports
func (s *VideoService) GetAllImports() ([]models.VideoImport, error) {
	return s.repo.GetAllImports()
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

	return s.treeSvc.BuildTreeFromPositions(positions)
}

// SearchByFEN searches for video imports containing a specific FEN position
func (s *VideoService) SearchByFEN(fen string) ([]models.VideoSearchResult, error) {
	return s.repo.SearchPositionsByFEN(fen)
}

func (s *VideoService) processVideo(importID, youtubeURL, videoID string, progressCh chan<- models.SSEProgressEvent) {
	defer close(progressCh)

	tmpDir := filepath.Join(os.TempDir(), fmt.Sprintf("treechess-video-%s", importID))
	defer os.RemoveAll(tmpDir)

	if err := os.MkdirAll(tmpDir, 0755); err != nil {
		s.failImport(importID, progressCh, fmt.Sprintf("failed to create temp directory: %v", err))
		return
	}

	// Step 1: Download video
	s.sendProgress(importID, progressCh, models.VideoStatusDownloading, 5, "Downloading video...")
	videoPath, title, err := s.downloadVideo(youtubeURL, tmpDir)
	if err != nil {
		s.failImport(importID, progressCh, fmt.Sprintf("failed to download video: %v", err))
		return
	}

	// Update title in DB
	if title != "" {
		_ = s.repo.UpdateImportStatus(importID, models.VideoStatusDownloading, 10, nil)
	}

	// Step 2: Extract frames
	s.sendProgress(importID, progressCh, models.VideoStatusExtracting, 15, "Extracting frames...")
	framesDir := filepath.Join(tmpDir, "frames")
	if err := os.MkdirAll(framesDir, 0755); err != nil {
		s.failImport(importID, progressCh, fmt.Sprintf("failed to create frames directory: %v", err))
		return
	}

	err = s.extractFrames(videoPath, framesDir)
	if err != nil {
		s.failImport(importID, progressCh, fmt.Sprintf("failed to extract frames: %v", err))
		return
	}

	// Step 3: Recognize positions
	s.sendProgress(importID, progressCh, models.VideoStatusRecognizing, 25, "Recognizing chess positions...")
	positions, err := s.recognizePositions(importID, framesDir, progressCh)
	if err != nil {
		s.failImport(importID, progressCh, fmt.Sprintf("failed to recognize positions: %v", err))
		return
	}

	// Step 4: Save positions to DB
	s.sendProgress(importID, progressCh, models.VideoStatusBuildingTree, 90, "Saving positions...")

	var dbPositions []models.VideoPosition
	for _, p := range positions {
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

func (s *VideoService) downloadVideo(youtubeURL, tmpDir string) (string, string, error) {
	outputTemplate := filepath.Join(tmpDir, "video.%(ext)s")

	cmd := exec.Command(s.cfg.YtdlpPath,
		"--no-playlist",
		"--format", "worst[ext=mp4]/worst",
		"--output", outputTemplate,
		"--print", "%(title)s",
		"--no-warnings",
		youtubeURL,
	)

	output, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return "", "", fmt.Errorf("yt-dlp failed: %s", string(exitErr.Stderr))
		}
		return "", "", fmt.Errorf("yt-dlp failed: %w", err)
	}

	title := strings.TrimSpace(string(output))

	// Find the downloaded video file
	entries, err := os.ReadDir(tmpDir)
	if err != nil {
		return "", "", fmt.Errorf("failed to read temp directory: %w", err)
	}

	for _, entry := range entries {
		if !entry.IsDir() && strings.HasPrefix(entry.Name(), "video.") {
			return filepath.Join(tmpDir, entry.Name()), title, nil
		}
	}

	return "", "", fmt.Errorf("downloaded video file not found")
}

func (s *VideoService) extractFrames(videoPath, framesDir string) error {
	cmd := exec.Command(s.cfg.FfmpegPath,
		"-i", videoPath,
		"-vf", "fps=1",
		"-q:v", "2",
		filepath.Join(framesDir, "frame_%06d.png"),
	)

	if output, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("ffmpeg failed: %s", string(output))
	}

	return nil
}

// recognitionResult maps the JSON output from the Python script
type recognitionResult struct {
	Positions       []recognizedPosition `json:"positions"`
	TotalFrames     int                  `json:"totalFrames"`
	FramesWithBoard int                  `json:"framesWithBoard"`
}

type recognizedPosition struct {
	FrameIndex       int     `json:"frameIndex"`
	TimestampSeconds float64 `json:"timestampSeconds"`
	FEN              string  `json:"fen"`
	Confidence       float64 `json:"confidence"`
	BoardDetected    bool    `json:"boardDetected"`
}

// stderrProgress maps the progress JSON from stderr
type stderrProgress struct {
	ProcessedFrames int `json:"processedFrames"`
	TotalFrames     int `json:"totalFrames"`
}

func (s *VideoService) recognizePositions(importID, framesDir string, progressCh chan<- models.SSEProgressEvent) ([]recognizedPosition, error) {
	cmd := exec.Command(s.cfg.PythonPath, s.cfg.ScriptPath, framesDir)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start recognition script: %w", err)
	}

	// Read stderr for progress updates in a goroutine
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			var progress stderrProgress
			if err := json.Unmarshal([]byte(line), &progress); err == nil {
				pct := 25 + int(float64(progress.ProcessedFrames)/float64(progress.TotalFrames)*60)
				if pct > 85 {
					pct = 85
				}

				_ = s.repo.UpdateImportFrames(importID, progress.TotalFrames, progress.ProcessedFrames)

				msg := fmt.Sprintf("Frame %d/%d", progress.ProcessedFrames, progress.TotalFrames)
				s.sendProgress(importID, progressCh, models.VideoStatusRecognizing, pct, msg)
			} else {
				log.Printf("Recognition stderr: %s", line)
			}
		}
	}()

	// Read stdout for final result
	var result recognitionResult
	decoder := json.NewDecoder(stdout)
	if err := decoder.Decode(&result); err != nil {
		_ = cmd.Wait()
		return nil, fmt.Errorf("failed to parse recognition output: %w", err)
	}

	if err := cmd.Wait(); err != nil {
		return nil, fmt.Errorf("recognition script failed: %w", err)
	}

	return result.Positions, nil
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
