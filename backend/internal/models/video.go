package models

import (
	"time"
)

// VideoImportStatus represents the status of a video import
type VideoImportStatus string

const (
	VideoStatusPending      VideoImportStatus = "pending"
	VideoStatusDownloading  VideoImportStatus = "downloading"
	VideoStatusExtracting   VideoImportStatus = "extracting"
	VideoStatusRecognizing  VideoImportStatus = "recognizing"
	VideoStatusBuildingTree VideoImportStatus = "building_tree"
	VideoStatusCompleted    VideoImportStatus = "completed"
	VideoStatusFailed       VideoImportStatus = "failed"
)

// VideoImport represents a YouTube video import
type VideoImport struct {
	ID              string            `json:"id"`
	YouTubeURL      string            `json:"youtubeUrl"`
	YouTubeID       string            `json:"youtubeId"`
	Title           string            `json:"title"`
	Status          VideoImportStatus `json:"status"`
	Progress        int               `json:"progress"`
	ErrorMessage    *string           `json:"errorMessage,omitempty"`
	TotalFrames     *int              `json:"totalFrames,omitempty"`
	ProcessedFrames int               `json:"processedFrames"`
	CreatedAt       time.Time         `json:"createdAt"`
	CompletedAt     *time.Time        `json:"completedAt,omitempty"`
}

// VideoPosition represents a chess position detected in a video frame
type VideoPosition struct {
	ID               string    `json:"id"`
	VideoImportID    string    `json:"videoImportId"`
	FEN              string    `json:"fen"`
	TimestampSeconds float64   `json:"timestampSeconds"`
	FrameIndex       int       `json:"frameIndex"`
	Confidence       *float64  `json:"confidence,omitempty"`
	CreatedAt        time.Time `json:"createdAt"`
}

// VideoImportRequest represents a request to import a YouTube video
type VideoImportRequest struct {
	YouTubeURL string `json:"youtubeUrl"`
}

// VideoImportSaveRequest represents a request to save a video import as a repertoire
type VideoImportSaveRequest struct {
	Name         string          `json:"name"`
	Color        Color           `json:"color"`
	RepertoireID *string         `json:"repertoireId,omitempty"`
	TreeData     RepertoireNode  `json:"treeData"`
}

// SSEProgressEvent represents a progress event sent via SSE
type SSEProgressEvent struct {
	Status          VideoImportStatus `json:"status"`
	Progress        int               `json:"progress"`
	Message         string            `json:"message"`
	ProcessedFrames int               `json:"processedFrames,omitempty"`
	TotalFrames     int               `json:"totalFrames,omitempty"`
}

// VideoSearchResult represents a video position search result
type VideoSearchResult struct {
	VideoImport VideoImport `json:"videoImport"`
	Positions   []VideoPosition `json:"positions"`
}
