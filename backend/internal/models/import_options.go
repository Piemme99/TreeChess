package models

// LichessImportOptions represents options for importing games from Lichess
type LichessImportOptions struct {
	Max      int    `json:"max,omitempty"`      // Max games to fetch (default: 20, max: 100)
	Since    int64  `json:"since,omitempty"`    // Timestamp Unix ms (start date)
	Until    int64  `json:"until,omitempty"`    // Timestamp Unix ms (end date)
	Rated    *bool  `json:"rated,omitempty"`    // Only rated games
	PerfType string `json:"perfType,omitempty"` // Game type: bullet, blitz, rapid, classical
}

// LichessImportRequest represents a request to import games from Lichess
type LichessImportRequest struct {
	Username string               `json:"username"`
	Options  LichessImportOptions `json:"options"`
}

// ChesscomImportOptions represents options for importing games from Chess.com
type ChesscomImportOptions struct {
	Max       int    `json:"max,omitempty"`       // Max games to fetch (default: 20, max: 100)
	Since     int64  `json:"since,omitempty"`     // Timestamp Unix ms (start date)
	Until     int64  `json:"until,omitempty"`     // Timestamp Unix ms (end date)
	TimeClass string `json:"timeClass,omitempty"` // Game type: daily, rapid, blitz, bullet
}

// ChesscomImportRequest represents a request to import games from Chess.com
type ChesscomImportRequest struct {
	Username string                `json:"username"`
	Options  ChesscomImportOptions `json:"options"`
}

// StudyChapterInfo represents metadata about a single Lichess study chapter
type StudyChapterInfo struct {
	Index       int    `json:"index"`
	Name        string `json:"name"`
	Orientation string `json:"orientation"`
	MoveCount   int    `json:"moveCount"`
	// Importable is false when the chapter cannot be imported as-is. When false,
	// SkipReason explains why.
	Importable bool   `json:"importable"`
	SkipReason string `json:"skipReason,omitempty"`
	// CustomStart is true when the chapter starts from a non-standard position
	// (Lichess "From Position"). Such chapters are importable as their own
	// repertoire (rooted at that FEN) but cannot be merged into a standard tree.
	CustomStart bool `json:"customStart,omitempty"`
}

// SkipReasonCustomStartingPosition is set on StudyChapterInfo / SkippedStudyChapter
// when a chapter uses a non-standard starting position ([SetUp "1"] / [FEN ...]).
const SkipReasonCustomStartingPosition = "custom-starting-position"

// SkippedStudyChapter records a chapter that was requested but not imported.
type SkippedStudyChapter struct {
	Index  int    `json:"index"`
	Name   string `json:"name"`
	Reason string `json:"reason"`
}

// StudyInfo represents metadata about a Lichess study
type StudyInfo struct {
	StudyID   string             `json:"studyId"`
	StudyName string             `json:"studyName"`
	OwnerName string             `json:"ownerName,omitempty"`
	Chapters  []StudyChapterInfo `json:"chapters"`
}

// StudyImportRequest represents a request to import chapters from a Lichess study
type StudyImportRequest struct {
	StudyURL        string `json:"studyUrl"`
	ChapterIndices  []int  `json:"chapters"`
	MergeAsOne      bool   `json:"mergeAsOne"`
	MergeName       string `json:"mergeName,omitempty"`
	CreateCategory  bool   `json:"createCategory,omitempty"`
	CategoryName    string `json:"categoryName,omitempty"`
	IncludeComments bool   `json:"includeComments,omitempty"`
	IncludeHints    bool   `json:"includeHints,omitempty"`
	OwnerName       string `json:"ownerName,omitempty"`
	// RenameStrategy controls behavior when a chapter's target repertoire name
	// already exists for this user+color. Accepted: "" or "abort" (default — return
	// 409 with conflicts), "auto-suffix" (append " (2)", " (3)", ... until unique).
	RenameStrategy string `json:"renameStrategy,omitempty"`
}

// RepertoireNameConflict describes a single name collision discovered before
// study import (or during merged import) — used to surface a clear 409 response.
type RepertoireNameConflict struct {
	ChapterIndex  int    `json:"chapterIndex"`
	ChapterName   string `json:"chapterName"`
	TargetName    string `json:"targetName"`
	ExistingID    string `json:"existingId"`
	ExistingColor string `json:"existingColor"`
}
