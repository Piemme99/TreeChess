package services

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"

	"github.com/google/uuid"
	"github.com/notnil/chess"

	"github.com/kumquat/backend/internal/models"
)

var (
	calRegex = regexp.MustCompile(`\[%cal\s+([A-Za-z0-9,]+)\]`)
	cslRegex = regexp.MustCompile(`\[%csl\s+([A-Za-z0-9,]+)\]`)
)

// annotationColorMap maps Lichess single-char color codes to hex colors.
var annotationColorMap = map[byte]string{
	'G': "#15781B",
	'R': "#882020",
	'B': "#003088",
	'Y': "#e68f00",
}

// parseAnnotations extracts [%cal ...] arrows and [%csl ...] square highlights
// from a PGN comment string. Returns cleaned comment text, arrows, and highlights.
func parseAnnotations(comment string) (string, []models.Arrow, []models.SquareHighlight) {
	var arrows []models.Arrow
	var highlights []models.SquareHighlight

	// Extract arrows from [%cal Gb4e1,Ra1h8]
	comment = calRegex.ReplaceAllStringFunc(comment, func(match string) string {
		sub := calRegex.FindStringSubmatch(match)
		if len(sub) < 2 {
			return match
		}
		for _, entry := range strings.Split(sub[1], ",") {
			entry = strings.TrimSpace(entry)
			if len(entry) < 5 {
				continue
			}
			colorChar := entry[0]
			hexColor, ok := annotationColorMap[colorChar]
			if !ok {
				hexColor = "#15781B" // default green
			}
			from := entry[1:3]
			to := entry[3:5]
			arrows = append(arrows, models.Arrow{From: from, To: to, Color: hexColor})
		}
		return ""
	})

	// Extract highlights from [%csl Rb4,Gb2]
	comment = cslRegex.ReplaceAllStringFunc(comment, func(match string) string {
		sub := cslRegex.FindStringSubmatch(match)
		if len(sub) < 2 {
			return match
		}
		for _, entry := range strings.Split(sub[1], ",") {
			entry = strings.TrimSpace(entry)
			if len(entry) < 3 {
				continue
			}
			colorChar := entry[0]
			hexColor, ok := annotationColorMap[colorChar]
			if !ok {
				hexColor = "#15781B"
			}
			square := entry[1:3]
			highlights = append(highlights, models.SquareHighlight{Square: square, Color: hexColor})
		}
		return ""
	})

	// Collapse leftover whitespace
	cleaned := strings.Join(strings.Fields(comment), " ")

	return cleaned, arrows, highlights
}

// PGN token types
type pgnTokenType int

const (
	tokenMove pgnTokenType = iota
	tokenMoveNumber
	tokenVariationStart
	tokenVariationEnd
	tokenComment
	tokenNAG
	tokenResult
)

type pgnToken struct {
	typ   pgnTokenType
	value string
}

// tokenizePGNMovetext splits PGN movetext into structured tokens.
// It handles move numbers, moves, variations ( ), comments { }, NAGs ($n, !, ?, etc.), and results.
func tokenizePGNMovetext(movetext string) []pgnToken {
	var tokens []pgnToken
	i := 0
	runes := []rune(movetext)
	n := len(runes)

	for i < n {
		ch := runes[i]

		// Skip whitespace
		if unicode.IsSpace(ch) {
			i++
			continue
		}

		// Comment: { ... }
		if ch == '{' {
			i++ // skip '{'
			start := i
			for i < n && runes[i] != '}' {
				i++
			}
			tokens = append(tokens, pgnToken{typ: tokenComment, value: string(runes[start:i])})
			if i < n {
				i++ // skip '}'
			}
			continue
		}

		// Line comment: ; until end of line
		if ch == ';' {
			for i < n && runes[i] != '\n' {
				i++
			}
			continue
		}

		// Variation start
		if ch == '(' {
			tokens = append(tokens, pgnToken{typ: tokenVariationStart, value: "("})
			i++
			continue
		}

		// Variation end
		if ch == ')' {
			tokens = append(tokens, pgnToken{typ: tokenVariationEnd, value: ")"})
			i++
			continue
		}

		// NAG: $n
		if ch == '$' {
			i++ // skip '$'
			start := i
			for i < n && unicode.IsDigit(runes[i]) {
				i++
			}
			tokens = append(tokens, pgnToken{typ: tokenNAG, value: "$" + string(runes[start:i])})
			continue
		}

		// Read a word (everything until whitespace or special char)
		start := i
		for i < n && !unicode.IsSpace(runes[i]) && runes[i] != '{' && runes[i] != '(' && runes[i] != ')' && runes[i] != ';' && runes[i] != '$' {
			i++
		}
		word := string(runes[start:i])

		if word == "" {
			continue
		}

		// Result tokens
		if word == "1-0" || word == "0-1" || word == "1/2-1/2" || word == "*" {
			tokens = append(tokens, pgnToken{typ: tokenResult, value: word})
			continue
		}

		// NAG-like annotations attached to moves: !, ?, !!, ??, !?, ?!
		// These can appear as standalone tokens
		if word == "!" || word == "?" || word == "!!" || word == "??" || word == "!?" || word == "?!" {
			tokens = append(tokens, pgnToken{typ: tokenNAG, value: word})
			continue
		}

		// Move number: digits followed by one or more dots (e.g. "1." or "1...")
		if isMoveNumber(word) {
			tokens = append(tokens, pgnToken{typ: tokenMoveNumber, value: word})
			continue
		}

		// Strip trailing annotation symbols from moves (e.g. "Nf3!" -> "Nf3" + NAG)
		cleanMove, nag := stripTrailingNAG(word)
		if cleanMove != "" {
			tokens = append(tokens, pgnToken{typ: tokenMove, value: cleanMove})
			if nag != "" {
				tokens = append(tokens, pgnToken{typ: tokenNAG, value: nag})
			}
		}
	}

	return tokens
}

// isMoveNumber checks if a word is a PGN move number like "1.", "12.", "1...", etc.
func isMoveNumber(word string) bool {
	// Must start with a digit and end with a dot
	if len(word) == 0 || !unicode.IsDigit(rune(word[0])) {
		return false
	}
	// Find where digits end
	i := 0
	for i < len(word) && unicode.IsDigit(rune(word[i])) {
		i++
	}
	// Rest must be dots only
	if i >= len(word) {
		return false // just digits, no dots
	}
	for i < len(word) {
		if word[i] != '.' {
			return false
		}
		i++
	}
	return true
}

// stripTrailingNAG removes trailing !, ?, !!, ??, !?, ?! from a move string.
func stripTrailingNAG(move string) (string, string) {
	suffixes := []string{"!!", "??", "!?", "?!", "!", "?"}
	for _, s := range suffixes {
		if strings.HasSuffix(move, s) {
			return move[:len(move)-len(s)], s
		}
	}
	return move, ""
}

// HasCustomStartingPosition reports whether the parsed PGN headers describe a
// chapter that starts from a non-standard position (Lichess "From Position"
// feature). Such chapters are rejected by ParsePGNToTree and surfaced to the UI
// so users know they were skipped.
func HasCustomStartingPosition(headers map[string]string) bool {
	fenHeader, ok := headers["FEN"]
	if !ok || fenHeader == "" {
		return false
	}
	const standardFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
	return ensureFullFEN(fenHeader) != standardFEN
}

// ParsePGNToTree parses a single PGN game text (with headers) into a RepertoireNode tree.
// Returns the root node, a map of PGN headers, and any error. Chapters that start
// from a custom position (Lichess "From Position") are rejected with
// ErrCustomStartingPosition; use ParseChapterPGNToTree to import those rooted at
// their starting FEN.
func ParsePGNToTree(pgnText string) (models.RepertoireNode, map[string]string, error) {
	return parsePGNToTree(pgnText, false)
}

// ParseChapterPGNToTree parses a PGN chapter into a RepertoireNode tree, allowing
// a custom starting position: the tree is rooted at the chapter's [FEN] header
// rather than the standard starting position.
func ParseChapterPGNToTree(pgnText string) (models.RepertoireNode, map[string]string, error) {
	return parsePGNToTree(pgnText, true)
}

func parsePGNToTree(pgnText string, allowCustomStart bool) (models.RepertoireNode, map[string]string, error) {
	headers, movetext := splitPGNHeadersAndMovetext(pgnText)
	tokens := tokenizePGNMovetext(movetext)

	customStart := HasCustomStartingPosition(headers)
	if customStart && !allowCustomStart {
		// Standard imports only support the standard starting position.
		return models.RepertoireNode{}, nil, ErrCustomStartingPosition
	}

	game := chess.NewGame()
	if customStart {
		fenFn, err := chess.FEN(ensureFullFEN(headers["FEN"]))
		if err != nil {
			return models.RepertoireNode{}, nil, fmt.Errorf("invalid starting FEN %q: %w", headers["FEN"], err)
		}
		game = chess.NewGame(fenFn)
	}
	startFEN := normalizeFEN(game.Position().String())

	rootColor := models.ChessColorWhite
	if fields := strings.Fields(startFEN); len(fields) > 1 && fields[1] == "b" {
		rootColor = models.ChessColorBlack
	}

	root := models.RepertoireNode{
		ID:          uuid.New().String(),
		FEN:         startFEN,
		Move:        nil,
		MoveNumber:  0,
		ColorToMove: rootColor,
		Children:    []*models.RepertoireNode{},
	}

	type stackEntry struct {
		node *models.RepertoireNode
		game *chess.Game
	}

	stack := []stackEntry{{node: &root, game: game}}
	pos := 0

	for pos < len(tokens) {
		tok := tokens[pos]

		switch tok.typ {
		case tokenMoveNumber, tokenNAG, tokenResult:
			// Skip these tokens
			pos++

		case tokenComment:
			// PGN comments after a move annotate that move's node
			commentText := strings.TrimSpace(tok.value)
			if commentText != "" && len(stack) > 0 {
				top := stack[len(stack)-1]
				if top.node.Move != nil {
					cleaned, arrows, highlights := parseAnnotations(commentText)
					if cleaned != "" {
						top.node.Comment = &cleaned
					}
					if len(arrows) > 0 {
						top.node.Arrows = arrows
					}
					if len(highlights) > 0 {
						top.node.Highlights = highlights
					}
				}
			}
			pos++

		case tokenMove:
			if len(stack) == 0 {
				return models.RepertoireNode{}, nil, fmt.Errorf("unexpected move token outside of context")
			}
			top := &stack[len(stack)-1]
			currentNode := top.node
			currentGame := top.game

			san := tok.value

			// Check if this move already exists as a child (deduplication)
			var existingChild *models.RepertoireNode
			for _, child := range currentNode.Children {
				if child.Move != nil && *child.Move == san {
					existingChild = child
					break
				}
			}

			if existingChild != nil {
				// Reuse existing child: advance game state and update stack
				gameCopy := cloneGame(currentGame)
				if err := gameCopy.MoveStr(san); err != nil {
					return models.RepertoireNode{}, nil, fmt.Errorf("invalid move %q: %w", san, err)
				}
				top.node = existingChild
				top.game = gameCopy
			} else {
				// Create new child node
				gameCopy := cloneGame(currentGame)
				if err := gameCopy.MoveStr(san); err != nil {
					return models.RepertoireNode{}, nil, fmt.Errorf("invalid move %q: %w", san, err)
				}

				resultFEN := normalizeFEN(gameCopy.Position().String())
				colorToMove := models.ChessColorWhite
				if strings.Fields(resultFEN)[1] == "b" {
					colorToMove = models.ChessColorBlack
				}

				moveSAN := san
				ply := countMoves(gameCopy)
				moveNumber := (ply + 1) / 2

				newNode := &models.RepertoireNode{
					ID:          uuid.New().String(),
					FEN:         resultFEN,
					Move:        &moveSAN,
					MoveNumber:  moveNumber,
					ColorToMove: colorToMove,
					ParentID:    &currentNode.ID,
					Children:    []*models.RepertoireNode{},
				}

				currentNode.Children = append(currentNode.Children, newNode)
				top.node = newNode
				top.game = gameCopy
			}
			pos++

		case tokenVariationStart:
			// Push: save current parent (the node we were on before the last move)
			// A variation branches from the parent of the current node.
			// We need to go back to the parent's position.
			if len(stack) == 0 {
				return models.RepertoireNode{}, nil, fmt.Errorf("unexpected variation start")
			}
			top := stack[len(stack)-1]

			// Find the parent node. The current node is what we just moved to,
			// so the variation should branch from the same parent.
			// We need to replay moves up to the parent's position.
			parentNode := findParentInTree(&root, top.node.ID)
			if parentNode == nil {
				// If we can't find parent, use root
				parentNode = &root
			}

			parentGame := replayToNode(&root, parentNode, game)

			stack = append(stack, stackEntry{node: parentNode, game: parentGame})
			pos++

		case tokenVariationEnd:
			// Pop variation
			if len(stack) > 1 {
				stack = stack[:len(stack)-1]
			}
			pos++

		default:
			pos++
		}
	}

	return root, headers, nil
}

// splitPGNHeadersAndMovetext separates PGN headers from the movetext.
func splitPGNHeadersAndMovetext(pgn string) (map[string]string, string) {
	headers := make(map[string]string)
	lines := strings.Split(pgn, "\n")
	movetextStart := 0

loop:
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		switch {
		case strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]"):
			// Parse header tag
			content := trimmed[1 : len(trimmed)-1]
			parts := strings.SplitN(content, " ", 2)
			if len(parts) == 2 {
				key := parts[0]
				value := strings.Trim(parts[1], "\"")
				headers[key] = value
			}
			movetextStart = i + 1
		case trimmed == "" && movetextStart == i:
			movetextStart = i + 1
		case trimmed != "":
			break loop
		}
	}

	movetext := strings.Join(lines[movetextStart:], "\n")
	return headers, movetext
}

// newGameFromStart returns a fresh game at g's starting position, preserving a
// custom starting FEN (Lichess "From Position") rather than assuming the
// standard initial position.
func newGameFromStart(g *chess.Game) *chess.Game {
	if g != nil {
		positions := g.Positions()
		if len(positions) > 0 {
			if fenFn, err := chess.FEN(positions[0].String()); err == nil {
				return chess.NewGame(fenFn)
			}
		}
	}
	return chess.NewGame()
}

// cloneGame creates a copy of a chess.Game at the same position by replaying moves.
func cloneGame(g *chess.Game) *chess.Game {
	newGame := newGameFromStart(g)
	for _, m := range g.Moves() {
		_ = newGame.Move(m)
	}
	return newGame
}

// countMoves returns the number of half-moves (plies) played in the game.
func countMoves(g *chess.Game) int {
	return len(g.Moves())
}

// findParentInTree finds the parent node of the node with the given ID.
func findParentInTree(root *models.RepertoireNode, childID string) *models.RepertoireNode {
	for _, child := range root.Children {
		if child.ID == childID {
			return root
		}
		if found := findParentInTree(child, childID); found != nil {
			return found
		}
	}
	return nil
}

// replayToNode rebuilds a chess.Game that reaches the position of the target node
// by walking the tree from root to the target node.
func replayToNode(root *models.RepertoireNode, target *models.RepertoireNode, baseGame *chess.Game) *chess.Game {
	// Find path from root to target
	path := findPathToNode(root, target.ID)
	if path == nil {
		return newGameFromStart(baseGame)
	}

	g := newGameFromStart(baseGame)
	// Skip root (index 0), replay moves along the path
	for i := 1; i < len(path); i++ {
		if path[i].Move != nil {
			if err := g.MoveStr(*path[i].Move); err != nil {
				// If replay fails, return game up to this point
				return g
			}
		}
	}
	return g
}

// findPathToNode returns the sequence of nodes from root to the node with the given ID.
func findPathToNode(node *models.RepertoireNode, targetID string) []*models.RepertoireNode {
	if node.ID == targetID {
		return []*models.RepertoireNode{node}
	}
	for _, child := range node.Children {
		if path := findPathToNode(child, targetID); path != nil {
			return append([]*models.RepertoireNode{node}, path...)
		}
	}
	return nil
}
