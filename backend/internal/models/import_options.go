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
}

// StudyInfo represents metadata about a Lichess study
type StudyInfo struct {
	StudyID   string             `json:"studyId"`
	StudyName string             `json:"studyName"`
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
}
