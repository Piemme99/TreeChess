package services

import (
	"context"
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

		info := models.StudyChapterInfo{
			Index:       i,
			Name:        name,
			Orientation: orientation,
			MoveCount:   moveCount,
			Importable:  true,
		}
		if HasCustomStartingPosition(headers) {
			// Importable on its own (rooted at the custom FEN), but flagged so the
			// UI can show it can't be merged into a standard repertoire.
			info.CustomStart = true
			info.SkipReason = models.SkipReasonCustomStartingPosition
		}
		chapterInfos = append(chapterInfos, info)
	}

	return &models.StudyInfo{
		StudyID:   studyID,
		StudyName: studyName,
		OwnerName: ownerName,
		Chapters:  chapterInfos,
	}, nil
}

// StudyImportResult contains the imported repertoires, optional created category,
// and any chapters that were requested but skipped (e.g. custom starting position).
type StudyImportResult struct {
	Repertoires []models.Repertoire          `json:"repertoires"`
	Category    *models.Category             `json:"category,omitempty"`
	Skipped     []models.SkippedStudyChapter `json:"skipped,omitempty"`
}

// Rename strategies for resolving repertoire name conflicts during study import.
const (
	RenameStrategyAbort      = "abort"
	RenameStrategyAutoSuffix = "auto-suffix"
)

// StudyImportConflictError is returned by the import flows when one or more
// target repertoire names collide with existing repertoires (same user + color)
// and the caller asked for the default abort strategy. The handler maps this
// to HTTP 409 so the UI can offer "open existing" / "import under new name".
type StudyImportConflictError struct {
	Conflicts []models.RepertoireNameConflict
}

func (e *StudyImportConflictError) Error() string {
	if len(e.Conflicts) == 1 {
		return fmt.Sprintf("a repertoire named %q already exists for this color", e.Conflicts[0].TargetName)
	}
	return fmt.Sprintf("%d repertoire names already exist for this color", len(e.Conflicts))
}

// normalizeRenameStrategy returns a canonical strategy value, defaulting to abort.
func normalizeRenameStrategy(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case RenameStrategyAutoSuffix:
		return RenameStrategyAutoSuffix
	default:
		return RenameStrategyAbort
	}
}

// uniqueNameWithSuffix returns the input name if it doesn't collide with any name in
// `taken`, otherwise appends " (2)", " (3)", ... until it doesn't. Comparison is
// case-sensitive to mirror the Postgres collation used by the unique constraint.
// The returned name is also added to `taken` so subsequent calls don't reuse it.
func uniqueNameWithSuffix(name string, taken map[string]bool) string {
	if !taken[name] {
		taken[name] = true
		return name
	}
	for i := 2; ; i++ {
		candidate := fmt.Sprintf("%s (%d)", name, i)
		if !taken[candidate] {
			taken[candidate] = true
			return candidate
		}
	}
}

// existingNamesByColor builds a lookup table of {color -> {name -> existingRepertoireID}}
// for the user, used to detect study-import conflicts before any writes.
func (s *StudyImportService) existingNamesByColor(ctx context.Context, userID string) (map[models.Color]map[string]string, error) {
	all, err := s.repertoireService.ListRepertoires(ctx, userID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to list existing repertoires: %w", err)
	}
	out := map[models.Color]map[string]string{}
	for _, r := range all {
		if out[r.Color] == nil {
			out[r.Color] = map[string]string{}
		}
		out[r.Color][r.Name] = r.ID
	}
	return out, nil
}

// ImportStudyChapters imports selected chapters from a Lichess study as new repertoires.
func (s *StudyImportService) ImportStudyChapters(ctx context.Context, userID, studyID, authToken string, chapterIndices []int) ([]models.Repertoire, error) {
	result, err := s.ImportStudyChaptersWithCategory(ctx, userID, studyID, authToken, chapterIndices, false, "", false, true, RenameStrategyAbort)
	if err != nil {
		return nil, err
	}
	return result.Repertoires, nil
}

// parsedChapter holds a study chapter that has been parsed and is ready to import.
type parsedChapter struct {
	index int
	name  string
	color models.Color
	root  models.RepertoireNode
}

// ImportStudyChaptersWithCategory imports selected chapters with optional category creation.
// When createCategory is true and chapters are not being merged, it creates a category
// and assigns all imported repertoires to it.
//
// renameStrategy controls behavior when a target name collides with an existing
// repertoire for the same user+color. See the RenameStrategy* constants.
// The optional ownerName variadic preserves backward compatibility with callers
// that don't pass an explicit owner — only the first value is honored.
func (s *StudyImportService) ImportStudyChaptersWithCategory(ctx context.Context, userID, studyID, authToken string, chapterIndices []int, createCategory bool, categoryName string, includeComments, includeHints bool, renameStrategy string, ownerName ...string) (*StudyImportResult, error) {
	pgnData, err := s.lichessService.FetchStudyPGN(studyID, authToken)
	if err != nil {
		return nil, err
	}

	chapters := splitRawPGNGames(pgnData)
	if len(chapters) == 0 {
		return nil, fmt.Errorf("no chapters found in study")
	}

	requested := make(map[int]bool, len(chapterIndices))
	for _, idx := range chapterIndices {
		requested[idx] = true
	}

	// Phase 1: parse all requested chapters, splitting into parsed + skipped.
	studyName := ""
	var parsed []parsedChapter
	var skipped []models.SkippedStudyChapter

	for i, chapterPGN := range chapters {
		if !requested[i] {
			continue
		}

		// Per-chapter import supports custom starting positions: such chapters
		// become their own repertoire rooted at the chapter's FEN.
		root, headers, parseErr := ParseChapterPGNToTree(chapterPGN)
		if parseErr != nil {
			return nil, fmt.Errorf("failed to parse chapter %d: %w", i, parseErr)
		}

		stripTreeAnnotations(&root, includeComments, includeHints)

		rawName := headers["Event"]
		if rawName == "" {
			rawName = fmt.Sprintf("Chapter %d", i+1)
		}
		if studyName == "" {
			if parts := strings.SplitN(rawName, ": ", 2); len(parts) == 2 {
				studyName = parts[0]
			} else {
				studyName = rawName
			}
		}
		chapterName := rawName
		if parts := strings.SplitN(rawName, ": ", 2); len(parts) == 2 {
			chapterName = parts[1]
		}

		orientation := strings.ToLower(headers["Orientation"])
		color := models.ColorWhite
		if orientation == "black" {
			color = models.ColorBlack
		}

		parsed = append(parsed, parsedChapter{
			index: i,
			name:  chapterName,
			color: color,
			root:  root,
		})
	}

	// Phase 2: detect name conflicts against existing repertoires (per color).
	existing, err := s.existingNamesByColor(ctx, userID)
	if err != nil {
		return nil, err
	}

	strategy := normalizeRenameStrategy(renameStrategy)

	// Track names being created in this batch so two chapters with the same
	// name + color don't collide with each other during auto-suffix.
	takenByColor := map[models.Color]map[string]bool{}
	for color, names := range existing {
		takenByColor[color] = map[string]bool{}
		for n := range names {
			takenByColor[color][n] = true
		}
	}

	var conflicts []models.RepertoireNameConflict
	targetNames := make([]string, len(parsed))
	for idx, pc := range parsed {
		if takenByColor[pc.color] == nil {
			takenByColor[pc.color] = map[string]bool{}
		}
		taken := takenByColor[pc.color]
		if !taken[pc.name] {
			taken[pc.name] = true
			targetNames[idx] = pc.name
			continue
		}
		if strategy == RenameStrategyAutoSuffix {
			targetNames[idx] = uniqueNameWithSuffix(pc.name, taken)
			continue
		}
		conflicts = append(conflicts, models.RepertoireNameConflict{
			ChapterIndex:  pc.index,
			ChapterName:   pc.name,
			TargetName:    pc.name,
			ExistingID:    existing[pc.color][pc.name],
			ExistingColor: string(pc.color),
		})
	}
	if len(conflicts) > 0 {
		return nil, &StudyImportConflictError{Conflicts: conflicts}
	}

	// Phase 3: determine dominant color across the parsed chapters (for the
	// optional category — same heuristic as before).
	colorsFound := map[models.Color]int{}
	for _, pc := range parsed {
		colorsFound[pc.color]++
	}
	detectedColor := models.ColorWhite
	if colorsFound[models.ColorBlack] > colorsFound[models.ColorWhite] {
		detectedColor = models.ColorBlack
	}

	// Phase 4: create the category (if requested) and the repertoires.
	var category *models.Category
	var categoryID *string
	if createCategory && s.categoryRepo != nil && len(parsed) > 0 {
		catName := categoryName
		if catName == "" {
			catName = studyName
		}
		if catName == "" {
			catName = "Imported Study"
		}

		cat, catErr := s.categoryRepo.Create(ctx, userID, catName, detectedColor)
		if catErr != nil {
			return nil, fmt.Errorf("failed to create category: %w", catErr)
		}
		category = cat
		categoryID = &cat.ID
	}

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

	var created []models.Repertoire
	for idx, pc := range parsed {
		name := targetNames[idx]

		var rep *models.Repertoire
		var createErr error
		if categoryID != nil && pc.color == detectedColor {
			rep, createErr = s.repertoireService.CreateRepertoireWithCategory(ctx, userID, name, pc.color, categoryID)
		} else {
			rep, createErr = s.repertoireService.CreateRepertoire(ctx, userID, name, pc.color)
		}
		if createErr != nil {
			return nil, fmt.Errorf("failed to create repertoire for chapter %d: %w", pc.index, createErr)
		}

		saved, saveErr := s.repertoireService.SaveTree(ctx, userID, rep.ID, pc.root)
		if saveErr != nil {
			return nil, fmt.Errorf("failed to save tree for chapter %d: %w", pc.index, saveErr)
		}

		if setErr := s.repertoireService.SetOrigin(ctx, saved.ID, userID, origin); setErr != nil {
			slog.Error("failed to set origin on imported repertoire", "repertoire_id", saved.ID, "error", setErr)
		} else {
			saved.Origin = origin
		}

		created = append(created, *saved)
	}

	return &StudyImportResult{
		Repertoires: created,
		Category:    category,
		Skipped:     skipped,
	}, nil
}

// ErrMixedColors is returned when trying to merge chapters with different orientations.
var ErrMixedColors = fmt.Errorf("cannot merge chapters with different colors")

// ErrAllChaptersSkipped is returned when a merge import has nothing to merge because
// every requested chapter was skipped (e.g. all use custom starting positions).
var ErrAllChaptersSkipped = fmt.Errorf("no chapters could be imported")

// MergedStudyImportResult is the result of merging selected chapters into a single repertoire.
type MergedStudyImportResult struct {
	Repertoire *models.Repertoire           `json:"repertoire"`
	Skipped    []models.SkippedStudyChapter `json:"skipped,omitempty"`
}

// ImportStudyChaptersMerged imports selected chapters from a Lichess study and merges them into a single repertoire.
//
// renameStrategy controls behavior when the merged repertoire name collides
// with an existing repertoire for the same user+color. See RenameStrategy* constants.
func (s *StudyImportService) ImportStudyChaptersMerged(ctx context.Context, userID, studyID, authToken string, chapterIndices []int, mergeName string, includeComments, includeHints bool, renameStrategy string, ownerName ...string) (*MergedStudyImportResult, error) {
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
	var skipped []models.SkippedStudyChapter

	for i, chapterPGN := range chapters {
		if !requested[i] {
			continue
		}

		root, headers, err := ParsePGNToTree(chapterPGN)
		if err != nil {
			if errors.Is(err, ErrCustomStartingPosition) {
				slog.Debug("skipping chapter with custom starting position", "chapter_index", i)
				skipped = append(skipped, models.SkippedStudyChapter{
					Index:  i,
					Name:   chapterDisplayName(chapterPGN, i),
					Reason: models.SkipReasonCustomStartingPosition,
				})
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
		return nil, ErrAllChaptersSkipped
	}

	// Use provided name or fall back to study name
	if mergeName == "" {
		mergeName = studyName
	}
	if mergeName == "" {
		mergeName = "Merged Study"
	}

	// Conflict check against existing repertoires of the same color.
	existing, err := s.existingNamesByColor(ctx, userID)
	if err != nil {
		return nil, err
	}
	strategy := normalizeRenameStrategy(renameStrategy)
	if existingID, taken := existing[detectedColor][mergeName]; taken {
		if strategy == RenameStrategyAutoSuffix {
			takenSet := map[string]bool{}
			for n := range existing[detectedColor] {
				takenSet[n] = true
			}
			mergeName = uniqueNameWithSuffix(mergeName, takenSet)
		} else {
			return nil, &StudyImportConflictError{Conflicts: []models.RepertoireNameConflict{{
				ChapterIndex:  -1,
				ChapterName:   mergeName,
				TargetName:    mergeName,
				ExistingID:    existingID,
				ExistingColor: string(detectedColor),
			}}}
		}
	}

	// Create one repertoire
	rep, err := s.repertoireService.CreateRepertoire(ctx, userID, mergeName, detectedColor)
	if err != nil {
		return nil, fmt.Errorf("failed to create repertoire: %w", err)
	}

	// Start with the first tree, merge the rest into it
	merged := parsedTrees[0]
	for i := 1; i < len(parsedTrees); i++ {
		mergeNodes(&merged, &parsedTrees[i])
	}

	// Save the merged tree
	saved, err := s.repertoireService.SaveTree(ctx, userID, rep.ID, merged)
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
	if setErr := s.repertoireService.SetOrigin(ctx, saved.ID, userID, origin); setErr != nil {
		slog.Error("failed to set origin on merged repertoire", "repertoire_id", saved.ID, "error", setErr)
	} else {
		saved.Origin = origin
	}

	return &MergedStudyImportResult{
		Repertoire: saved,
		Skipped:    skipped,
	}, nil
}

// chapterDisplayName returns a human-friendly chapter name extracted from PGN
// headers (Event header, with study-name prefix stripped), falling back to a
// "Chapter N" placeholder. Used when reporting skipped chapters.
func chapterDisplayName(chapterPGN string, index int) string {
	headers, _ := splitPGNHeadersAndMovetext(chapterPGN)
	name := headers["Event"]
	if name == "" {
		return fmt.Sprintf("Chapter %d", index+1)
	}
	if parts := strings.SplitN(name, ": ", 2); len(parts) == 2 {
		return parts[1]
	}
	return name
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
func (s *StudyImportService) GetLichessTokenForUser(ctx context.Context, userID string) string {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil {
		return ""
	}
	if user.LichessAccessToken == nil {
		return ""
	}
	return *user.LichessAccessToken
}
