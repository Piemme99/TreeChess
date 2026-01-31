package services

import (
	"fmt"
	"strings"
	"unicode"

	"github.com/google/uuid"
	"github.com/notnil/chess"

	"github.com/treechess/backend/internal/models"
)

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

// ParsePGNToTree parses a single PGN game text (with headers) into a RepertoireNode tree.
// Returns the root node, a map of PGN headers, and any error.
func ParsePGNToTree(pgnText string) (models.RepertoireNode, map[string]string, error) {
	headers, movetext := splitPGNHeadersAndMovetext(pgnText)
	tokens := tokenizePGNMovetext(movetext)

	// Reject custom starting positions — only standard openings are supported
	if fenHeader, ok := headers["FEN"]; ok && fenHeader != "" {
		standardFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
		if ensureFullFEN(fenHeader) != standardFEN {
			return models.RepertoireNode{}, nil, ErrCustomStartingPosition
		}
	}

	game := chess.NewGame()
	startFEN := normalizeFEN(game.Position().String())

	root := models.RepertoireNode{
		ID:          uuid.New().String(),
		FEN:         startFEN,
		Move:        nil,
		MoveNumber:  0,
		ColorToMove: models.ChessColorWhite,
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
					top.node.Comment = &commentText
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

	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]") {
			// Parse header tag
			content := trimmed[1 : len(trimmed)-1]
			parts := strings.SplitN(content, " ", 2)
			if len(parts) == 2 {
				key := parts[0]
				value := strings.Trim(parts[1], "\"")
				headers[key] = value
			}
			movetextStart = i + 1
		} else if trimmed == "" && movetextStart == i {
			movetextStart = i + 1
		} else if trimmed != "" {
			break
		}
	}

	movetext := strings.Join(lines[movetextStart:], "\n")
	return headers, movetext
}

// cloneGame creates a copy of a chess.Game at the same position by replaying moves.
func cloneGame(g *chess.Game) *chess.Game {
	moves := g.Moves()
	newGame := chess.NewGame()
	for _, m := range moves {
		newGame.Move(m)
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
		return chess.NewGame()
	}

	g := chess.NewGame()
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
