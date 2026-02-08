package models

// LichessStudyOwner represents the owner of a Lichess study.
type LichessStudyOwner struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// LichessStudyResult represents a single study from Lichess search/browse results.
type LichessStudyResult struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Liked     bool              `json:"liked"`
	Likes     int               `json:"likes"`
	Owner     LichessStudyOwner `json:"owner"`
	Chapters  []interface{}     `json:"chapters"`
	Topics    []string          `json:"topics"`
	CreatedAt int64             `json:"createdAt"`
	UpdatedAt int64             `json:"updatedAt"`
}

// LichessStudyPaginator holds pagination info and results for Lichess study search/browse.
// Lichess nests currentPageResults inside the paginator object.
type LichessStudyPaginator struct {
	CurrentPage        int                  `json:"currentPage"`
	MaxPerPage         int                  `json:"maxPerPage"`
	CurrentPageResults []LichessStudyResult `json:"currentPageResults"`
	NbResults          int                  `json:"nbResults"`
	NbPages            int                  `json:"nbPages"`
	PreviousPage       *int                 `json:"previousPage"`
	NextPage           *int                 `json:"nextPage"`
}

// LichessStudySearchResponse is the top-level response from Lichess study search/browse.
type LichessStudySearchResponse struct {
	Paginator LichessStudyPaginator `json:"paginator"`
}

// LichessTopicsResponse holds the list of popular study topics from Lichess.
type LichessTopicsResponse struct {
	Popular []string `json:"popular"`
}
