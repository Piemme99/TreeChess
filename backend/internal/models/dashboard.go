package models

// RepertoireStats holds per-repertoire dashboard metrics
type RepertoireStats struct {
	RepertoireID    string  `json:"repertoireId"`
	RepertoireName  string  `json:"repertoireName"`
	Color           Color   `json:"color"`
	GameCount       int     `json:"gameCount"`
	CoveragePercent float64 `json:"coveragePercent"`
	WinRate         float64 `json:"winRate"`
	WinRateInRep    float64 `json:"winRateInRep"`
	WinRateOutRep   float64 `json:"winRateOutRep"`
	InRepCount      int     `json:"inRepCount"`
	OutRepCount     int     `json:"outRepCount"`
}

// OpponentGap represents a frequent opponent move not covered in the repertoire
type OpponentGap struct {
	FEN            string  `json:"fen"`          // Position before the opponent's move
	OpponentMove   string  `json:"opponentMove"` // SAN of the opponent's move
	Frequency      int     `json:"frequency"`    // How many games this occurred in
	WinRate        float64 `json:"winRate"`      // User's win rate when facing this move
	Wins           int     `json:"wins"`
	Losses         int     `json:"losses"`
	Draws          int     `json:"draws"`
	RepertoireID   string  `json:"repertoireId"` // Which repertoire this belongs to
	RepertoireName string  `json:"repertoireName"`
	Color          Color   `json:"color"`       // Repertoire color
	MoveNumber     int     `json:"moveNumber"`  // Move number in the game
	ContextMove    string  `json:"contextMove"` // Last in-repertoire move before the gap (for display)
}

// BranchStats holds per-branch performance metrics
type BranchStats struct {
	BranchName     string  `json:"branchName"`
	RepertoireID   string  `json:"repertoireId"`
	RepertoireName string  `json:"repertoireName"`
	Color          Color   `json:"color"`
	GameCount      int     `json:"gameCount"`
	WinRate        float64 `json:"winRate"`
	Wins           int     `json:"wins"`
	Losses         int     `json:"losses"`
	Draws          int     `json:"draws"`
	ErrorRate      float64 `json:"errorRate"` // Fraction of games where user deviated
	ErrorCount     int     `json:"errorCount"`
}

// DashboardStatsResponse is the response for GET /api/dashboard/stats
type DashboardStatsResponse struct {
	TotalGames      int               `json:"totalGames"`
	Wins            int               `json:"wins"`
	Losses          int               `json:"losses"`
	Draws           int               `json:"draws"`
	OverallWinRate  float64           `json:"overallWinRate"`
	OverallCoverage float64           `json:"overallCoverage"`
	WinRateInRep    float64           `json:"winRateInRep"`
	WinRateOutRep   float64           `json:"winRateOutRep"`
	InRepCount      int               `json:"inRepCount"`
	OutRepCount     int               `json:"outRepCount"`
	Repertoires     []RepertoireStats `json:"repertoires"`

	// New metrics
	OpeningErrorRate  float64       `json:"openingErrorRate"`  // Fraction of matched games where user deviated
	OpeningErrorCount int           `json:"openingErrorCount"` // Number of games with user deviation
	MatchedGamesCount int           `json:"matchedGamesCount"` // Games that matched a repertoire (excludes new-opening)
	OpponentGaps      []OpponentGap `json:"opponentGaps"`      // Top frequent opponent moves not in repertoire
	BranchStats       []BranchStats `json:"branchStats"`       // Per-branch performance stats
}
