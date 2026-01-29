package services

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/treechess/backend/config"
	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/recognition"
	"github.com/treechess/backend/internal/repository/mocks"
)

// --- Mock CommandRunner ---

type mockCommandRunner struct {
	RunFunc    func(name string, args ...string) ([]byte, error)
	OutputFunc func(name string, args ...string) ([]byte, error)
}

func (m *mockCommandRunner) Run(name string, args ...string) ([]byte, error) {
	if m.RunFunc != nil {
		return m.RunFunc(name, args...)
	}
	return nil, nil
}

func (m *mockCommandRunner) Output(name string, args ...string) ([]byte, error) {
	if m.OutputFunc != nil {
		return m.OutputFunc(name, args...)
	}
	return nil, nil
}

func (m *mockCommandRunner) RunContext(ctx context.Context, name string, args ...string) ([]byte, error) {
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	return m.Run(name, args...)
}

func (m *mockCommandRunner) OutputContext(ctx context.Context, name string, args ...string) ([]byte, error) {
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	return m.Output(name, args...)
}

// --- Mock Recognizer ---

type mockRecognizer struct {
	RecognizeFunc func(ctx context.Context, framesDir string, onProgress recognition.ProgressFunc) (*recognition.Result, error)
}

func (m *mockRecognizer) RecognizeFrames(ctx context.Context, framesDir string, onProgress recognition.ProgressFunc) (*recognition.Result, error) {
	if m.RecognizeFunc != nil {
		return m.RecognizeFunc(ctx, framesDir, onProgress)
	}
	return &recognition.Result{}, nil
}

// --- findDownloadedVideo tests ---

func TestFindDownloadedVideo_ExpectedPathExists(t *testing.T) {
	tmpDir := t.TempDir()
	expected := filepath.Join(tmpDir, "video.mp4")
	require.NoError(t, os.WriteFile(expected, []byte("fake video"), 0644))

	path, err := findDownloadedVideo(tmpDir, expected)
	require.NoError(t, err)
	assert.Equal(t, expected, path)
}

func TestFindDownloadedVideo_FallbackFindsOtherFile(t *testing.T) {
	tmpDir := t.TempDir()
	altFile := filepath.Join(tmpDir, "video.webm")
	require.NoError(t, os.WriteFile(altFile, []byte("fake video"), 0644))

	path, err := findDownloadedVideo(tmpDir, filepath.Join(tmpDir, "video.mp4"))
	require.NoError(t, err)
	assert.Equal(t, altFile, path)
}

func TestFindDownloadedVideo_EmptyDir(t *testing.T) {
	tmpDir := t.TempDir()

	_, err := findDownloadedVideo(tmpDir, filepath.Join(tmpDir, "video.mp4"))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "downloaded video file not found")
}

func TestFindDownloadedVideo_DirDoesNotExist(t *testing.T) {
	_, err := findDownloadedVideo("/nonexistent/path", "/nonexistent/path/video.mp4")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "cannot read dir")
}

func TestFindDownloadedVideo_OnlySubdirs(t *testing.T) {
	tmpDir := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(tmpDir, "subdir"), 0755))

	_, err := findDownloadedVideo(tmpDir, filepath.Join(tmpDir, "video.mp4"))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "downloaded video file not found")
}

// --- downloadVideo tests ---

func TestDownloadVideo_Success(t *testing.T) {
	tmpDir := t.TempDir()

	runner := &mockCommandRunner{
		OutputFunc: func(name string, args ...string) ([]byte, error) {
			return []byte("Chess Opening Tutorial\n"), nil
		},
		RunFunc: func(name string, args ...string) ([]byte, error) {
			outputPath := filepath.Join(tmpDir, "video.mp4")
			require.NoError(t, os.WriteFile(outputPath, []byte("fake video data"), 0644))
			return []byte("Download complete"), nil
		},
	}

	svc := &VideoService{
		cfg:    config.Config{YtdlpPath: "yt-dlp"},
		runner: runner,
	}

	path, title, err := svc.downloadVideo(context.Background(), "https://www.youtube.com/watch?v=abc", tmpDir)
	require.NoError(t, err)
	assert.Equal(t, filepath.Join(tmpDir, "video.mp4"), path)
	assert.Equal(t, "Chess Opening Tutorial", title)
}

func TestDownloadVideo_YtdlpFails(t *testing.T) {
	tmpDir := t.TempDir()

	runner := &mockCommandRunner{
		OutputFunc: func(name string, args ...string) ([]byte, error) {
			return nil, fmt.Errorf("network error")
		},
		RunFunc: func(name string, args ...string) ([]byte, error) {
			return []byte("ERROR: Video unavailable"), fmt.Errorf("exit status 1")
		},
	}

	svc := &VideoService{
		cfg:    config.Config{YtdlpPath: "yt-dlp"},
		runner: runner,
	}

	_, _, err := svc.downloadVideo(context.Background(), "https://www.youtube.com/watch?v=abc", tmpDir)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "yt-dlp failed")
	assert.Contains(t, err.Error(), "Video unavailable")
}

func TestDownloadVideo_FileNotCreated(t *testing.T) {
	tmpDir := t.TempDir()

	runner := &mockCommandRunner{
		OutputFunc: func(name string, args ...string) ([]byte, error) {
			return []byte("Some Title"), nil
		},
		RunFunc: func(name string, args ...string) ([]byte, error) {
			return []byte("Done"), nil
		},
	}

	svc := &VideoService{
		cfg:    config.Config{YtdlpPath: "yt-dlp"},
		runner: runner,
	}

	_, _, err := svc.downloadVideo(context.Background(), "https://www.youtube.com/watch?v=abc", tmpDir)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "downloaded video file not found")
}

func TestDownloadVideo_FallbackExtension(t *testing.T) {
	tmpDir := t.TempDir()

	runner := &mockCommandRunner{
		OutputFunc: func(name string, args ...string) ([]byte, error) {
			return []byte("Title"), nil
		},
		RunFunc: func(name string, args ...string) ([]byte, error) {
			require.NoError(t, os.WriteFile(filepath.Join(tmpDir, "video.webm"), []byte("webm data"), 0644))
			return nil, nil
		},
	}

	svc := &VideoService{
		cfg:    config.Config{YtdlpPath: "yt-dlp"},
		runner: runner,
	}

	path, title, err := svc.downloadVideo(context.Background(), "https://www.youtube.com/watch?v=abc", tmpDir)
	require.NoError(t, err)
	assert.Equal(t, filepath.Join(tmpDir, "video.webm"), path)
	assert.Equal(t, "Title", title)
}

func TestDownloadVideo_TitleFetchFailsButDownloadSucceeds(t *testing.T) {
	tmpDir := t.TempDir()

	runner := &mockCommandRunner{
		OutputFunc: func(name string, args ...string) ([]byte, error) {
			return nil, fmt.Errorf("title fetch failed")
		},
		RunFunc: func(name string, args ...string) ([]byte, error) {
			require.NoError(t, os.WriteFile(filepath.Join(tmpDir, "video.mp4"), []byte("data"), 0644))
			return nil, nil
		},
	}

	svc := &VideoService{
		cfg:    config.Config{YtdlpPath: "yt-dlp"},
		runner: runner,
	}

	path, title, err := svc.downloadVideo(context.Background(), "https://www.youtube.com/watch?v=abc", tmpDir)
	require.NoError(t, err)
	assert.Equal(t, filepath.Join(tmpDir, "video.mp4"), path)
	assert.Equal(t, "", title)
}

// --- extractFrames tests ---

func TestExtractFrames_Success(t *testing.T) {
	runner := &mockCommandRunner{
		RunFunc: func(name string, args ...string) ([]byte, error) {
			return []byte("ffmpeg output"), nil
		},
	}

	svc := &VideoService{
		cfg:    config.Config{FfmpegPath: "ffmpeg"},
		runner: runner,
	}

	err := svc.extractFrames(context.Background(), "/tmp/video.mp4", "/tmp/frames")
	require.NoError(t, err)
}

func TestExtractFrames_FfmpegFails(t *testing.T) {
	runner := &mockCommandRunner{
		RunFunc: func(name string, args ...string) ([]byte, error) {
			return []byte("Error: invalid codec"), fmt.Errorf("exit status 1")
		},
	}

	svc := &VideoService{
		cfg:    config.Config{FfmpegPath: "ffmpeg"},
		runner: runner,
	}

	err := svc.extractFrames(context.Background(), "/tmp/video.mp4", "/tmp/frames")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "ffmpeg failed")
	assert.Contains(t, err.Error(), "invalid codec")
}

// --- processVideo integration tests ---

func newTestRecognizer(result *recognition.Result, err error) *mockRecognizer {
	return &mockRecognizer{
		RecognizeFunc: func(ctx context.Context, framesDir string, onProgress recognition.ProgressFunc) (*recognition.Result, error) {
			return result, err
		},
	}
}

func TestProcessVideo_FullPipeline_Success(t *testing.T) {
	var mu sync.Mutex
	var savedPositions []models.VideoPosition
	var statusUpdates []models.VideoImportStatus
	var completed bool

	mockRepo := &mocks.MockVideoRepo{
		UpdateImportStatusFunc: func(id string, status models.VideoImportStatus, progress int, errorMsg *string) error {
			mu.Lock()
			statusUpdates = append(statusUpdates, status)
			mu.Unlock()
			return nil
		},
		UpdateImportFramesFunc: func(id string, totalFrames, processedFrames int) error {
			return nil
		},
		SavePositionsFunc: func(positions []models.VideoPosition) error {
			mu.Lock()
			savedPositions = positions
			mu.Unlock()
			return nil
		},
		CompleteImportFunc: func(id string) error {
			mu.Lock()
			completed = true
			mu.Unlock()
			return nil
		},
	}

	tmpBase := t.TempDir()

	recResult := &recognition.Result{
		TotalFrames:     2,
		FramesWithBoard: 2,
		Positions: []recognition.RecognizedPosition{
			{FrameIndex: 1, TimestampSeconds: 1.0, FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", Confidence: 0.9, BoardDetected: true},
			{FrameIndex: 2, TimestampSeconds: 2.0, FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3", Confidence: 0.85, BoardDetected: true},
		},
	}

	callCount := 0
	runner := &mockCommandRunner{
		OutputFunc: func(name string, args ...string) ([]byte, error) {
			return []byte("Test Video Title"), nil
		},
		RunFunc: func(name string, args ...string) ([]byte, error) {
			callCount++
			if callCount == 1 {
				for i, a := range args {
					if a == "--output" && i+1 < len(args) {
						require.NoError(t, os.WriteFile(args[i+1], []byte("video data"), 0644))
						return nil, nil
					}
				}
			}
			return nil, nil
		},
	}

	cfg := config.Config{
		YtdlpPath:  "yt-dlp",
		FfmpegPath: "ffmpeg",
	}

	treeSvc := NewTreeBuilderService()
	svc := NewVideoServiceWithDeps(mockRepo, cfg, treeSvc, runner, newTestRecognizer(recResult, nil))

	importID := "test-import-123"
	progressCh := make(chan models.SSEProgressEvent, 100)

	// Step 1: Download
	videoPath, title, err := svc.downloadVideo(context.Background(), "https://youtube.com/watch?v=abc", tmpBase)
	require.NoError(t, err)
	assert.Equal(t, "Test Video Title", title)
	assert.FileExists(t, videoPath)

	// Step 2: Extract frames (mock does nothing, but we create frames dir)
	framesDir := filepath.Join(tmpBase, "frames")
	require.NoError(t, os.MkdirAll(framesDir, 0755))
	err = svc.extractFrames(context.Background(), videoPath, framesDir)
	require.NoError(t, err)

	// Step 3: Recognize
	result, err := svc.recognizePositions(context.Background(), importID, framesDir, progressCh)
	require.NoError(t, err)
	assert.Len(t, result.Positions, 2)
	assert.True(t, result.Positions[0].BoardDetected)
	assert.True(t, result.Positions[1].BoardDetected)

	// Step 4: Filter and save
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
	require.NoError(t, mockRepo.SavePositions(dbPositions))

	mu.Lock()
	assert.Len(t, savedPositions, 2)
	mu.Unlock()

	// Step 5: Complete
	require.NoError(t, mockRepo.CompleteImport(importID))
	mu.Lock()
	assert.True(t, completed)
	mu.Unlock()
}

func TestProcessVideo_DownloadFails_SendsFailEvent(t *testing.T) {
	var failedStatus models.VideoImportStatus
	var failedMsg string

	mockRepo := &mocks.MockVideoRepo{
		UpdateImportStatusFunc: func(id string, status models.VideoImportStatus, progress int, errorMsg *string) error {
			if errorMsg != nil {
				failedStatus = status
				failedMsg = *errorMsg
			}
			return nil
		},
	}

	runner := &mockCommandRunner{
		OutputFunc: func(name string, args ...string) ([]byte, error) {
			return nil, fmt.Errorf("network error")
		},
		RunFunc: func(name string, args ...string) ([]byte, error) {
			return []byte("ERROR: unable to download"), fmt.Errorf("exit status 1")
		},
	}

	cfg := config.Config{YtdlpPath: "yt-dlp", FfmpegPath: "ffmpeg"}
	treeSvc := NewTreeBuilderService()
	svc := NewVideoServiceWithDeps(mockRepo, cfg, treeSvc, runner, newTestRecognizer(nil, nil))

	progressCh := make(chan models.SSEProgressEvent, 100)
	svc.processVideo(context.Background(), "import-1", "https://youtube.com/watch?v=abc", "abc", progressCh)

	var events []models.SSEProgressEvent
	for ev := range progressCh {
		events = append(events, ev)
	}

	require.NotEmpty(t, events)
	lastEvent := events[len(events)-1]
	assert.Equal(t, models.VideoStatusFailed, lastEvent.Status)
	assert.Contains(t, lastEvent.Message, "failed to download video")

	assert.Equal(t, models.VideoStatusFailed, failedStatus)
	assert.Contains(t, failedMsg, "failed to download video")
}

func TestProcessVideo_ExtractFails_SendsFailEvent(t *testing.T) {
	var failedMsg string

	mockRepo := &mocks.MockVideoRepo{
		UpdateImportStatusFunc: func(id string, status models.VideoImportStatus, progress int, errorMsg *string) error {
			if errorMsg != nil {
				failedMsg = *errorMsg
			}
			return nil
		},
	}

	callCount := 0
	runner := &mockCommandRunner{
		OutputFunc: func(name string, args ...string) ([]byte, error) {
			return []byte("Title"), nil
		},
		RunFunc: func(name string, args ...string) ([]byte, error) {
			callCount++
			if callCount == 1 {
				for i, a := range args {
					if a == "--output" && i+1 < len(args) {
						os.WriteFile(args[i+1], []byte("video"), 0644)
						return nil, nil
					}
				}
			}
			// ffmpeg: fail
			return []byte("ffmpeg error output"), fmt.Errorf("exit status 1")
		},
	}

	cfg := config.Config{YtdlpPath: "yt-dlp", FfmpegPath: "ffmpeg"}
	treeSvc := NewTreeBuilderService()
	svc := NewVideoServiceWithDeps(mockRepo, cfg, treeSvc, runner, newTestRecognizer(nil, nil))

	progressCh := make(chan models.SSEProgressEvent, 100)
	svc.processVideo(context.Background(), "import-2", "https://youtube.com/watch?v=abc", "abc", progressCh)

	var events []models.SSEProgressEvent
	for ev := range progressCh {
		events = append(events, ev)
	}

	require.NotEmpty(t, events)
	lastEvent := events[len(events)-1]
	assert.Equal(t, models.VideoStatusFailed, lastEvent.Status)
	assert.Contains(t, lastEvent.Message, "failed to extract frames")
	assert.Contains(t, failedMsg, "failed to extract frames")
}

func TestProcessVideo_RecognizeFails_SendsFailEvent(t *testing.T) {
	var failedMsg string

	mockRepo := &mocks.MockVideoRepo{
		UpdateImportStatusFunc: func(id string, status models.VideoImportStatus, progress int, errorMsg *string) error {
			if errorMsg != nil {
				failedMsg = *errorMsg
			}
			return nil
		},
		UpdateImportFramesFunc: func(id string, totalFrames, processedFrames int) error {
			return nil
		},
	}

	callCount := 0
	runner := &mockCommandRunner{
		OutputFunc: func(name string, args ...string) ([]byte, error) {
			return []byte("Title"), nil
		},
		RunFunc: func(name string, args ...string) ([]byte, error) {
			callCount++
			if callCount == 1 {
				for i, a := range args {
					if a == "--output" && i+1 < len(args) {
						os.WriteFile(args[i+1], []byte("video"), 0644)
						return nil, nil
					}
				}
			}
			// ffmpeg: succeed
			return nil, nil
		},
	}

	failRecognizer := &mockRecognizer{
		RecognizeFunc: func(ctx context.Context, framesDir string, onProgress recognition.ProgressFunc) (*recognition.Result, error) {
			return nil, fmt.Errorf("recognition error: invalid frames")
		},
	}

	cfg := config.Config{YtdlpPath: "yt-dlp", FfmpegPath: "ffmpeg"}
	treeSvc := NewTreeBuilderService()
	svc := NewVideoServiceWithDeps(mockRepo, cfg, treeSvc, runner, failRecognizer)

	progressCh := make(chan models.SSEProgressEvent, 100)
	svc.processVideo(context.Background(), "import-3", "https://youtube.com/watch?v=abc", "abc", progressCh)

	var events []models.SSEProgressEvent
	for ev := range progressCh {
		events = append(events, ev)
	}

	require.NotEmpty(t, events)
	lastEvent := events[len(events)-1]
	assert.Equal(t, models.VideoStatusFailed, lastEvent.Status)
	assert.Contains(t, lastEvent.Message, "failed to recognize positions")
	assert.Contains(t, failedMsg, "failed to recognize positions")
}

func TestProcessVideo_CompletePipeline_Success(t *testing.T) {
	var mu sync.Mutex
	var savedPositions []models.VideoPosition
	var completed bool
	var statusHistory []models.VideoImportStatus

	mockRepo := &mocks.MockVideoRepo{
		UpdateImportStatusFunc: func(id string, status models.VideoImportStatus, progress int, errorMsg *string) error {
			mu.Lock()
			statusHistory = append(statusHistory, status)
			mu.Unlock()
			return nil
		},
		UpdateImportFramesFunc: func(id string, totalFrames, processedFrames int) error {
			return nil
		},
		SavePositionsFunc: func(positions []models.VideoPosition) error {
			mu.Lock()
			savedPositions = positions
			mu.Unlock()
			return nil
		},
		CompleteImportFunc: func(id string) error {
			mu.Lock()
			completed = true
			mu.Unlock()
			return nil
		},
	}

	recResult := &recognition.Result{
		TotalFrames:     2,
		FramesWithBoard: 1,
		Positions: []recognition.RecognizedPosition{
			{FrameIndex: 1, TimestampSeconds: 1.0, FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", Confidence: 0.9, BoardDetected: true},
			{FrameIndex: 2, TimestampSeconds: 2.0, FEN: "", Confidence: 0.0, BoardDetected: false},
		},
	}

	callCount := 0
	runner := &mockCommandRunner{
		OutputFunc: func(name string, args ...string) ([]byte, error) {
			return []byte("Chess Video"), nil
		},
		RunFunc: func(name string, args ...string) ([]byte, error) {
			callCount++
			if callCount == 1 {
				for i, a := range args {
					if a == "--output" && i+1 < len(args) {
						os.WriteFile(args[i+1], []byte("video"), 0644)
						return nil, nil
					}
				}
			}
			return nil, nil
		},
	}

	cfg := config.Config{YtdlpPath: "yt-dlp", FfmpegPath: "ffmpeg"}
	treeSvc := NewTreeBuilderService()
	svc := NewVideoServiceWithDeps(mockRepo, cfg, treeSvc, runner, newTestRecognizer(recResult, nil))

	progressCh := make(chan models.SSEProgressEvent, 100)
	svc.processVideo(context.Background(), "import-ok", "https://youtube.com/watch?v=abc", "abc", progressCh)

	var events []models.SSEProgressEvent
	for ev := range progressCh {
		events = append(events, ev)
	}

	require.NotEmpty(t, events)
	lastEvent := events[len(events)-1]
	assert.Equal(t, models.VideoStatusCompleted, lastEvent.Status)
	assert.Equal(t, 100, lastEvent.Progress)

	mu.Lock()
	assert.Len(t, savedPositions, 1)
	assert.Equal(t, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", savedPositions[0].FEN)
	assert.True(t, completed)

	assert.Contains(t, statusHistory, models.VideoStatusDownloading)
	assert.Contains(t, statusHistory, models.VideoStatusExtracting)
	assert.Contains(t, statusHistory, models.VideoStatusRecognizing)
	assert.Contains(t, statusHistory, models.VideoStatusBuildingTree)
	assert.Contains(t, statusHistory, models.VideoStatusCompleted)
	mu.Unlock()
}

func TestProcessVideo_NoBoardsDetected_StillCompletes(t *testing.T) {
	var completed bool

	mockRepo := &mocks.MockVideoRepo{
		UpdateImportStatusFunc: func(id string, status models.VideoImportStatus, progress int, errorMsg *string) error {
			return nil
		},
		UpdateImportFramesFunc: func(id string, totalFrames, processedFrames int) error {
			return nil
		},
		SavePositionsFunc: func(positions []models.VideoPosition) error {
			t.Fatal("SavePositions should not be called when no boards detected")
			return nil
		},
		CompleteImportFunc: func(id string) error {
			completed = true
			return nil
		},
	}

	recResult := &recognition.Result{
		TotalFrames:     2,
		FramesWithBoard: 0,
		Positions: []recognition.RecognizedPosition{
			{FrameIndex: 1, TimestampSeconds: 1.0, FEN: "", Confidence: 0.0, BoardDetected: false},
			{FrameIndex: 2, TimestampSeconds: 2.0, FEN: "", Confidence: 0.0, BoardDetected: false},
		},
	}

	callCount := 0
	runner := &mockCommandRunner{
		OutputFunc: func(name string, args ...string) ([]byte, error) {
			return []byte("Title"), nil
		},
		RunFunc: func(name string, args ...string) ([]byte, error) {
			callCount++
			if callCount == 1 {
				for i, a := range args {
					if a == "--output" && i+1 < len(args) {
						os.WriteFile(args[i+1], []byte("video"), 0644)
						return nil, nil
					}
				}
			}
			return nil, nil
		},
	}

	cfg := config.Config{YtdlpPath: "yt-dlp", FfmpegPath: "ffmpeg"}
	treeSvc := NewTreeBuilderService()
	svc := NewVideoServiceWithDeps(mockRepo, cfg, treeSvc, runner, newTestRecognizer(recResult, nil))

	progressCh := make(chan models.SSEProgressEvent, 100)
	svc.processVideo(context.Background(), "import-noboards", "https://youtube.com/watch?v=abc", "abc", progressCh)

	for range progressCh {
	}

	assert.True(t, completed, "import should still complete even with no boards detected")
}

// --- SubmitImport tests ---

func TestSubmitImport_InvalidURL(t *testing.T) {
	svc := &VideoService{}
	_, _, err := svc.SubmitImport("user-1", "not-a-url")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid YouTube URL")
}

func TestSubmitImport_RepoCreateFails(t *testing.T) {
	mockRepo := &mocks.MockVideoRepo{
		CreateImportFunc: func(userID string, youtubeURL, youtubeID, title string) (*models.VideoImport, error) {
			return nil, fmt.Errorf("db connection failed")
		},
	}

	svc := &VideoService{repo: mockRepo}
	_, _, err := svc.SubmitImport("user-1", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to create video import")
}

func TestSubmitImport_Success(t *testing.T) {
	mockRepo := &mocks.MockVideoRepo{
		CreateImportFunc: func(userID string, youtubeURL, youtubeID, title string) (*models.VideoImport, error) {
			return &models.VideoImport{
				ID:        "new-import",
				YouTubeID: youtubeID,
				Status:    models.VideoStatusPending,
			}, nil
		},
		UpdateImportStatusFunc: func(id string, status models.VideoImportStatus, progress int, errorMsg *string) error {
			return nil
		},
	}

	runner := &mockCommandRunner{
		OutputFunc: func(name string, args ...string) ([]byte, error) {
			return nil, fmt.Errorf("not found")
		},
		RunFunc: func(name string, args ...string) ([]byte, error) {
			return []byte("failed"), fmt.Errorf("exit 1")
		},
	}

	cfg := config.Config{YtdlpPath: "yt-dlp", FfmpegPath: "ffmpeg"}
	treeSvc := NewTreeBuilderService()
	svc := NewVideoServiceWithDeps(mockRepo, cfg, treeSvc, runner, newTestRecognizer(nil, nil))

	vi, ch, err := svc.SubmitImport("user-1", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
	require.NoError(t, err)
	assert.Equal(t, "new-import", vi.ID)
	assert.Equal(t, "dQw4w9WgXcQ", vi.YouTubeID)
	assert.NotNil(t, ch)

	timeout := time.After(5 * time.Second)
	for {
		select {
		case _, ok := <-ch:
			if !ok {
				return
			}
		case <-timeout:
			t.Fatal("timed out waiting for processVideo goroutine")
		}
	}
}
