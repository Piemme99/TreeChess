package services

import (
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"strings"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
)

// StudyImportService handles importing Lichess studies as repertoires.
type StudyImportService struct {
	lichessService    LichessGameFetcher
	repertoireService RepertoireManager
	categoryRepo      repository.CategoryRepository
	userRepo          repository.UserRepository
}

// NewStudyImportService creates a new study import service.
func NewStudyImportService(lichessSvc LichessGameFetcher, repertoireSvc RepertoireManager, categoryRepo repository.CategoryRepository, userRepo repository.UserRepository) *StudyImportService {
	return &StudyImportService{
		lichessService:    lichessSvc,
		repertoireService: repertoireSvc,
		categoryRepo:      categoryRepo,
		userRepo:          userRepo,
	}
}

// lichessStudyURLPattern matches Lichess study URLs.
// Accepts: https://lichess.org/study/abcdef12, https://lichess.org/study/abcdef12/ghijkl34, or raw ID.
var lichessStudyURLPattern = regexp.MustCompile(`(?:https?://lichess\.org/study/)?([a-zA-Z0-9]{8})(?:/([a-zA-Z0-9]{8}))?`)

// ParseStudyURL extracts the study ID and optional chapter ID from a Lichess study URL or raw ID.
func ParseStudyURL(rawURL string) (studyID, chapterID string, err error) {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return "", "", fmt.Errorf("study URL is required")
	}

	matches := lichessStudyURLPattern.FindStringSubmatch(rawURL)
	if matches == nil {
		return "", "", fmt.Errorf("invalid Lichess study URL or ID: %s", rawURL)
	}

	studyID = matches[1]
	if len(matches) > 2 {
		chapterID = matches[2]
	}
	return studyID, chapterID, nil
}

// PreviewStudy fetches a Lichess study and returns metadata about its chapters
// without creating any repertoires.
func (s *StudyImportService) PreviewStudy(studyID, authToken string) (*models.StudyInfo, error) {
	pgnData, err := s.lichessService.FetchStudyPGN(studyID, authToken)
	if err != nil {
		return nil, err
	}

	chapters := splitRawPGNGames(pgnData)
	if len(chapters) == 0 {
		return nil, fmt.Errorf("no chapters found in study")
	}

	// Fetch study metadata to get the owner name
	var ownerName string
	studyMeta, err := s.lichessService.FetchStudyMetadata(studyID, authToken)
	if err == nil && studyMeta != nil {
		ownerName = studyMeta.Owner.Name
	} else {
		slog.Debug("could not fetch study metadata for owner name", "study_id", studyID, "error", err)
	}

	studyName := ""
	var chapterInfos []models.StudyChapterInfo

	for i, chapterPGN := range chapters {
		headers, movetext := splitPGNHeadersAndMovetext(chapterPGN)

		name := headers["Event"]
		if name == "" {
			name = fmt.Sprintf("Chapter %d", i+1)
		}
		// Lichess study events often have format "StudyName: ChapterName"
		if studyName == "" {
			if parts := strings.SplitN(name, ": ", 2); len(parts) == 2 {
				studyName = parts[0]
				name = parts[1]
			} else {
				studyName = name
			}
		} else {
			if parts := strings.SplitN(name, ": ", 2); len(parts) == 2 {
				name = parts[1]
			}
		}

		orientation := strings.ToLower(headers["Orientation"])
		if orientation != "white" && orientation != "black" {
			orientation = "white"
		}

		// Quick count of moves by counting move tokens
		tokens := tokenizePGNMovetext(movetext)
		moveCount := 0
		for _, tok := range tokens {
			if tok.typ == tokenMove {
				moveCount++
			}
		}

		chapterInfos = append(chapterInfos, models.StudyChapterInfo{
			Index:       i,
			Name:        name,
			Orientation: orientation,
			MoveCount:   moveCount,
		})
	}

	return &models.StudyInfo{
		StudyID:   studyID,
		StudyName: studyName,
		OwnerName: ownerName,
		Chapters:  chapterInfos,
	}, nil
}

// StudyImportResult contains the imported repertoires and optional created category
type StudyImportResult struct {
	Repertoires []models.Repertoire `json:"repertoires"`
	Category    *models.Category    `json:"category,omitempty"`
}

// ImportStudyChapters imports selected chapters from a Lichess study as new repertoires.
func (s *StudyImportService) ImportStudyChapters(userID, studyID, authToken string, chapterIndices []int) ([]models.Repertoire, error) {
	result, err := s.ImportStudyChaptersWithCategory(userID, studyID, authToken, chapterIndices, false, "", false, true)
	if err != nil {
		return nil, err
	}
	return result.Repertoires, nil
}

// ImportStudyChaptersWithCategory imports selected chapters with optional category creation.
// When createCategory is true and chapters are not being merged, it creates a category
// and assigns all imported repertoires to it.
func (s *StudyImportService) ImportStudyChaptersWithCategory(userID, studyID, authToken string, chapterIndices []int, createCategory bool, categoryName string, includeComments, includeHints bool, ownerName ...string) (*StudyImportResult, error) {
	pgnData, err := s.lichessService.FetchStudyPGN(studyID, authToken)
	if err != nil {
		return nil, err
	}

	chapters := splitRawPGNGames(pgnData)
	if len(chapters) == 0 {
		return nil, fmt.Errorf("no chapters found in study")
	}

	// Build a set of requested indices for quick lookup
	requested := make(map[int]bool, len(chapterIndices))
	for _, idx := range chapterIndices {
		requested[idx] = true
	}

	studyName := ""
	// First pass: determine study name and dominant color
	var detectedColor models.Color
	colorsFound := make(map[models.Color]int)

	for i, chapterPGN := range chapters {
		if !requested[i] {
			continue
		}

		headers, _ := splitPGNHeadersAndMovetext(chapterPGN)
		name := headers["Event"]
		if studyName == "" {
			if parts := strings.SplitN(name, ": ", 2); len(parts) == 2 {
				studyName = parts[0]
			} else {
				studyName = name
			}
		}

		orientation := strings.ToLower(headers["Orientation"])
		color := models.ColorWhite
		if orientation == "black" {
			color = models.ColorBlack
		}
		colorsFound[color]++
	}

	// Determine the dominant color (for category creation)
	if colorsFound[models.ColorWhite] >= colorsFound[models.ColorBlack] {
		detectedColor = models.ColorWhite
	} else {
		detectedColor = models.ColorBlack
	}

	// Create category if requested
	var category *models.Category
	var categoryID *string
	if createCategory && s.categoryRepo != nil {
		catName := categoryName
		if catName == "" {
			catName = studyName
		}
		if catName == "" {
			catName = "Imported Study"
		}

		cat, err := s.categoryRepo.Create(userID, catName, detectedColor)
		if err != nil {
			return nil, fmt.Errorf("failed to create category: %w", err)
		}
		category = cat
		categoryID = &cat.ID
	}

	// Resolve the origin owner name
	resolvedOwner := ""
	if len(ownerName) > 0 && ownerName[0] != "" {
		resolvedOwner = ownerName[0]
	} else {
		// Try to fetch from Lichess metadata
		meta, metaErr := s.lichessService.FetchStudyMetadata(studyID, authToken)
		if metaErr == nil && meta != nil {
			resolvedOwner = meta.Owner.Name
		}
	}

	// Build origin to set on each imported repertoire
	origin := &models.RepertoireOrigin{
		Type:    "lichess",
		URL:     fmt.Sprintf("https://lichess.org/study/%s", studyID),
		Creator: resolvedOwner,
	}

	var created []models.Repertoire

	for i, chapterPGN := range chapters {
		if !requested[i] {
			continue
		}

		root, headers, err := ParsePGNToTree(chapterPGN)
		if err != nil {
			if errors.Is(err, ErrCustomStartingPosition) {
				slog.Debug("skipping chapter with custom starting position", "chapter_index", i)
				continue
			}
			return nil, fmt.Errorf("failed to parse chapter %d: %w", i, err)
		}

		stripTreeAnnotations(&root, includeComments, includeHints)

		// Determine chapter name
		name := headers["Event"]
		if name == "" {
			name = fmt.Sprintf("Chapter %d", i+1)
		}
		if parts := strings.SplitN(name, ": ", 2); len(parts) == 2 {
			name = parts[1]
		}

		// Determine color from Orientation header
		orientation := strings.ToLower(headers["Orientation"])
		color := models.ColorWhite
		if orientation == "black" {
			color = models.ColorBlack
		}

		// Create the repertoire (with category if one was created and colors match)
		var rep *models.Repertoire
		if categoryID != nil && color == detectedColor {
			rep, err = s.repertoireService.CreateRepertoireWithCategory(userID, name, color, categoryID)
		} else {
			rep, err = s.repertoireService.CreateRepertoire(userID, name, color)
		}
		if err != nil {
			return nil, fmt.Errorf("failed to create repertoire for chapter %d: %w", i, err)
		}

		// Save the parsed tree
		saved, err := s.repertoireService.SaveTree(userID, rep.ID, root)
		if err != nil {
			return nil, fmt.Errorf("failed to save tree for chapter %d: %w", i, err)
		}

		// Set Lichess origin
		if setErr := s.repertoireService.SetOrigin(saved.ID, origin); setErr != nil {
			slog.Error("failed to set origin on imported repertoire", "repertoire_id", saved.ID, "error", setErr)
		} else {
			saved.Origin = origin
		}

		created = append(created, *saved)
	}

	return &StudyImportResult{
		Repertoires: created,
		Category:    category,
	}, nil
}

// ErrMixedColors is returned when trying to merge chapters with different orientations.
var ErrMixedColors = fmt.Errorf("cannot merge chapters with different colors")

// ImportStudyChaptersMerged imports selected chapters from a Lichess study and merges them into a single repertoire.
func (s *StudyImportService) ImportStudyChaptersMerged(userID, studyID, authToken string, chapterIndices []int, mergeName string, includeComments, includeHints bool, ownerName ...string) (*models.Repertoire, error) {
	pgnData, err := s.lichessService.FetchStudyPGN(studyID, authToken)
	if err != nil {
		return nil, err
	}

	chapters := splitRawPGNGames(pgnData)
	if len(chapters) == 0 {
		return nil, fmt.Errorf("no chapters found in study")
	}

	// Build a set of requested indices for quick lookup
	requested := make(map[int]bool, len(chapterIndices))
	for _, idx := range chapterIndices {
		requested[idx] = true
	}

	studyName := ""
	var parsedTrees []models.RepertoireNode
	var detectedColor models.Color

	for i, chapterPGN := range chapters {
		if !requested[i] {
			continue
		}

		root, headers, err := ParsePGNToTree(chapterPGN)
		if err != nil {
			if errors.Is(err, ErrCustomStartingPosition) {
				slog.Debug("skipping chapter with custom starting position", "chapter_index", i)
				continue
			}
			return nil, fmt.Errorf("failed to parse chapter %d: %w", i, err)
		}

		stripTreeAnnotations(&root, includeComments, includeHints)

		// Extract study name for fallback
		name := headers["Event"]
		if studyName == "" {
			if parts := strings.SplitN(name, ": ", 2); len(parts) == 2 {
				studyName = parts[0]
			} else {
				studyName = name
			}
		}

		// Determine color from Orientation header
		orientation := strings.ToLower(headers["Orientation"])
		color := models.ColorWhite
		if orientation == "black" {
			color = models.ColorBlack
		}

		// Validate all chapters have the same color
		if len(parsedTrees) == 0 {
			detectedColor = color
		} else if color != detectedColor {
			return nil, ErrMixedColors
		}

		parsedTrees = append(parsedTrees, root)
	}

	if len(parsedTrees) == 0 {
		return nil, fmt.Errorf("no chapters could be parsed")
	}

	// Use provided name or fall back to study name
	if mergeName == "" {
		mergeName = studyName
	}
	if mergeName == "" {
		mergeName = "Merged Study"
	}

	// Create one repertoire
	rep, err := s.repertoireService.CreateRepertoire(userID, mergeName, detectedColor)
	if err != nil {
		return nil, fmt.Errorf("failed to create repertoire: %w", err)
	}

	// Start with the first tree, merge the rest into it
	merged := parsedTrees[0]
	for i := 1; i < len(parsedTrees); i++ {
		mergeNodes(&merged, &parsedTrees[i])
	}

	// Save the merged tree
	saved, err := s.repertoireService.SaveTree(userID, rep.ID, merged)
	if err != nil {
		return nil, fmt.Errorf("failed to save merged tree: %w", err)
	}

	// Set Lichess origin
	resolvedOwner := ""
	if len(ownerName) > 0 && ownerName[0] != "" {
		resolvedOwner = ownerName[0]
	} else {
		meta, metaErr := s.lichessService.FetchStudyMetadata(studyID, authToken)
		if metaErr == nil && meta != nil {
			resolvedOwner = meta.Owner.Name
		}
	}

	origin := &models.RepertoireOrigin{
		Type:    "lichess",
		URL:     fmt.Sprintf("https://lichess.org/study/%s", studyID),
		Creator: resolvedOwner,
	}
	if setErr := s.repertoireService.SetOrigin(saved.ID, origin); setErr != nil {
		slog.Error("failed to set origin on merged repertoire", "repertoire_id", saved.ID, "error", setErr)
	} else {
		saved.Origin = origin
	}

	return saved, nil
}

// stripTreeAnnotations recursively removes comments and/or hints (arrows, highlights)
// from a parsed tree based on the given flags.
func stripTreeAnnotations(node *models.RepertoireNode, keepComments, keepHints bool) {
	if !keepComments {
		node.Comment = nil
	}
	if !keepHints {
		node.Arrows = nil
		node.Highlights = nil
	}
	for _, child := range node.Children {
		stripTreeAnnotations(child, keepComments, keepHints)
	}
}

// SearchStudies searches Lichess studies by query.
func (s *StudyImportService) SearchStudies(query, order string, page int, authToken string) (*models.LichessStudySearchResponse, error) {
	return s.lichessService.SearchStudies(query, order, page, authToken)
}

// BrowseStudiesByTopic fetches studies for a given topic.
func (s *StudyImportService) BrowseStudiesByTopic(topic, sort string, page int, authToken string) (*models.LichessStudySearchResponse, error) {
	return s.lichessService.BrowseStudiesByTopic(topic, sort, page, authToken)
}

// BrowseAllStudies fetches all studies with a sort order.
func (s *StudyImportService) BrowseAllStudies(sort string, page int, authToken string) (*models.LichessStudySearchResponse, error) {
	return s.lichessService.BrowseAllStudies(sort, page, authToken)
}

// GetPopularTopics fetches popular study topics from Lichess.
func (s *StudyImportService) GetPopularTopics() (*models.LichessTopicsResponse, error) {
	return s.lichessService.GetPopularTopics()
}

// GetLichessTokenForUser retrieves the stored Lichess access token for a user.
// Returns empty string if no token is stored.
func (s *StudyImportService) GetLichessTokenForUser(userID string) string {
	user, err := s.userRepo.GetByID(userID)
	if err != nil || user == nil {
		return ""
	}
	if user.LichessAccessToken == nil {
		return ""
	}
	return *user.LichessAccessToken
}
