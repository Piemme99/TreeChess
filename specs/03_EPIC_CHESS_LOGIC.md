# Epic 3: Chess Logic

**Objective:** Implement chess rules validation, move generation, and PGN parsing

**Status:** Not Started  
**Dependencies:** Epic 2 (Backend API)

---

## 1. Objective

Create chess logic utilities that:
- Validate moves using chess.js
- Parse PGN files (headers + moves)
- Convert between SAN and FEN
- Handle transpositions (same position, different move order)
- Handle promotions (e8=Q, e8=R, etc.)

This logic can be used by both backend (for PGN import) and frontend (for move input).

---

## 2. Definition of Done

- [ ] chess.js validates legal moves correctly
- [ ] PGN parser extracts headers correctly
- [ ] PGN parser extracts moves in SAN format
- [ ] SAN move can be converted to board position
- [ ] FEN is generated correctly after each move
- [ ] Transpositions are handled (policy defined)
- [ ] Promotions are handled (default to Queen)
- [ ] All edge cases tested (castling, en passant, etc.)

---

## 3. Tasks

### 3.1 Chess Validator (Frontend/Shared)

**File: `src/utils/chessValidator.ts`**

```typescript
import { Chess, Move, Square } from 'chess.js';

export interface ValidatedMove {
  san: string;
  lan: string;
  from: Square;
  to: Square;
  piece: string;
  captured?: string;
  promotion?: string;
  isCheck: boolean;
  isCheckmate: boolean;
  isCastling: boolean;
}

export class ChessValidator {
  private game: Chess;

  constructor(fen?: string) {
    this.game = new Chess(fen);
  }

  /**
   * Validate a SAN move and return details
   */
  validateMove(move SAN: string): ValidatedMove | null {
    try {
      const result = this.game.move(move, { strict: true });
      if (!result) {
        return null;
      }
      
      return {
        san: result.san,
        lan: result.lan,
        from: result.from as Square,
        to: result.to as Square,
        piece: result.piece,
        captured: result.captured,
        promotion: result.promotion,
        isCheck: this.game.inCheck(),
        isCheckmate: this.game.isCheckmate(),
        isCastling: result.san.includes('O-O'),
      };
    } catch {
      return null;
    }
  }

  /**
   * Get all legal moves from current position
   */
  getLegalMoves(): string[] {
    return this.game.moves();
  }

  /**
   * Get all legal moves with details
   */
  getLegalMovesDetailed(): Move[] {
    return this.game.moves({ verbose: true });
  }

  /**
   * Get FEN of current position
   */
  getFEN(): string {
    return this.game.fen();
  }

  /**
   * Get turn to move
   */
  getTurn(): 'w' | 'b' {
    return this.game.turn() as 'w' | 'b';
  }

  /**
   * Get move number
   */
  getMoveNumber(): number {
    return this.game.moveNumber();
  }

  /**
   * Undo last move
   */
  undo(): boolean {
    return this.game.undo();
  }

  /**
   * Reset to initial position
   */
  reset(): void {
    this.game.reset();
  }

  /**
   * Load from FEN
   */
  loadFEN(fen: string): boolean {
    try {
      this.game.load(fen);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if position is valid
   */
  isValid(): boolean {
    return !this.game.isGameOver() && !this.game.isDraw();
  }

  /**
   * Get all possible promotions for a move
   */
  getPromotionOptions(from: Square, to: Square): string[] {
    const moves = this.game.moves({ verbose: true });
    const relevant = moves.filter(
      m => m.from === from && m.to === to && m.promotion
    );
    return [...new Set(relevant.map(m => m.promotion))];
  }

  /**
   * Play a move with promotion choice
   */
  playMoveWithPromotion(move SAN: string, promotion: 'q' | 'r' | 'b' | 'n'): ValidatedMove | null {
    try {
      const result = this.game.move(move, { promotion });
      if (!result) {
        return null;
      }
      
      return {
        san: result.san,
        lan: result.lan,
        from: result.from as Square,
        to: result.to as Square,
        piece: result.piece,
        captured: result.captured,
        promotion: result.promotion,
        isCheck: this.game.inCheck(),
        isCheckmate: this.game.isCheckmate(),
        isCastling: result.san.includes('O-O'),
      };
    } catch {
      return null;
    }
  }
}
```

### 3.2 PGN Parser (Backend)

**File: `internal/services/pgn_parser.go`**

```go
package services

import (
    "errors"
    "regexp"
    "strconv"
    "strings"

    "github.com/treechess/backend/internal/models"
)

type PGNGame struct {
    Headers map[string]string
    Moves   []PGNMove
}

type PGNMove struct {
    Number      int
    SAN         string
    IsWhiteMove bool
    FEN         string
}

// PGNParser parses PGN files
type PGNParser struct{}

func NewPGNParser() *PGNParser {
    return &PGNParser{}
}

// ParseGames parses multiple games from PGN content
func (p *PGNParser) ParseGames(content string) ([]PGNGame, error) {
    var games []PGNGame

    // Split content into individual games
    gameBlocks := splitGames(content)

    for _, block := range gameBlocks {
        if strings.TrimSpace(block) == "" {
            continue
        }

        game, err := p.parseGame(block)
        if err != nil {
            return nil, err
        }

        games = append(games, *game)
    }

    return games, nil
}

// parseGame parses a single game
func (p *PGNParser) parseGame(content string) (*PGNGame, error) {
    game := &PGNGame{
        Headers: make(map[string]string),
        Moves:   []PGNMove{},
    }

    lines := strings.Split(content, "\n")
    inHeaders := true
    moveSection := ""

    for _, line := range lines {
        line = strings.TrimSpace(line)
        
        // Parse header lines
        if inHeaders && strings.HasPrefix(line, "[") {
            key, value := parseHeader(line)
            if key != "" {
                game.Headers[key] = value
            }
            continue
        }

        // End of headers
        if inHeaders && line == "" {
            inHeaders = false
            continue
        }

        // Collect move text
        if !inHeaders {
            moveSection += " " + line
        }
    }

    // Parse moves
    moves, err := parseMoveSection(moveSection)
    if err != nil {
        return nil, err
    }

    game.Moves = moves
    return game, nil
}

// parseHeader extracts key-value from PGN header like [Event "Casual Game"]
func parseHeader(line string) (string, string) {
    re := regexp.MustCompile(`\[(\w+)\s+"([^"]*)"\]`)
    matches := re.FindStringSubmatch(line)
    if len(matches) != 3 {
        return "", ""
    }
    return matches[1], matches[2]
}

// splitGames splits PGN content into individual games
func splitGames(content string) []string {
    // A new game starts after a result (1-0, 0-1, 1/2-1/2, *)
    // followed by a header like [Event or just a newline
    re := regexp.MustCompile(`(?:\d+-\d+|\d/\d-\d/\d|\*)\s*(?=\[Event|$)`)
    
    // Use a simpler approach: split by double newlines before [Event
    parts := regexp.MustCompile(`(?m)^\[Event`).Split(content, -1)
    
    if len(parts) == 0 {
        return []string{content}
    }

    games := make([]string, 0, len(parts))
    for i, part := range parts {
        if i > 0 {
            part = "[Event" + part
        }
        if strings.TrimSpace(part) != "" {
            games = append(games, part)
        }
    }

    return games
}

// parseMoveSection parses the SAN moves from move section
func parseMoveSection(section string) ([]PGNMove, error) {
    // Remove result markers at the end
    section = regexp.MustCompile(`\s*(?:1-0|0-1|1/2-1/2|\*)\s*$`).ReplaceAllString(section, "")

    // Tokenize: remove numbers, periods, and extra whitespace
    tokens := tokenizeMoves(section)

    var moves []PGNMove
    currentFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
    moveNumber := 1

    for _, token := range tokens {
        token = strings.TrimSpace(token)
        if token == "" {
            continue
        }

        // Skip move numbers (1., 2., etc.)
        if regexp.MustCompile(`^\d+\.$`).MatchString(token) {
            continue
        }

        // Check if this is a Black move (follows a White move)
        isWhiteMove := len(moves)%2 == 0

        moves = append(moves, PGNMove{
            Number:      moveNumber,
            SAN:         token,
            IsWhiteMove: isWhiteMove,
            FEN:         currentFEN,
        })

        // Increment move number after Black move
        if !isWhiteMove {
            moveNumber++
        }

        // Note: We don't update FEN here as that's done during validation
    }

    return moves, nil
}

// tokenizeMoves extracts SAN moves from move text
func tokenizeMoves(section string) []string {
    // Remove comments
    section = regexp.MustCompile(`\{[^}]*\}`).ReplaceAllString(section, "")
    // Remove variations
    section = regexp.MustCompile(`\([^)]*\)`).ReplaceAllString(section, "")
    // Remove NAGs ($1, $2, etc.)
    section = regexp.MustCompile(`\$\d+`).ReplaceAllString(section, "")
    
    // Split by whitespace and newlines
    tokens := regexp.MustCompile(`\s+`).Split(section, -1)
    
    var result []string
    for _, token := range tokens {
        token = strings.TrimSpace(token)
        if token != "" {
            result = append(result, token)
        }
    }

    return result
}

// ValidateMoves validates a sequence of SAN moves and returns analysis
func (p *PGNParser) ValidateMoves(initialFEN string, moves []PGNMove) ([]MoveAnalysis, error) {
    var analysis []MoveAnalysis

    // Import chess logic here or use a Go chess library
    // For now, this is a placeholder that returns the FEN as-is
    for i, move := range moves {
        analysis = append(analysis, MoveAnalysis{
            SAN:    move.SAN,
            FEN:    move.FEN,
            Valid:  true, // Placeholder
            Number: move.Number,
        })
    }

    return analysis, nil
}

// MoveAnalysis represents the analysis of a single move
type MoveAnalysis struct {
    SAN       string
    FEN       string
    Valid     bool
    Number    int
    Error     string
}
```

### 3.3 Chess Logic Service (Backend)

**File: `internal/services/chess_service.go`**

```go
package services

import (
    "fmt"

    "github.com/notnil/chess"
)

type ChessService struct{}

func NewChessService() *ChessService {
    return &ChessService{}
}

// ValidateMove validates a SAN move on a given position
func (s *ChessService) ValidateMove(fen, san string) (*ValidatedMove, error) {
    position := chess.NewPosition()
    if err := position.UnmarshalText([]byte(fen)); err != nil {
        return nil, fmt.Errorf("invalid FEN: %w", err)
    }

    move, err := chess.ParseSAN(san)
    if err != nil {
        return nil, fmt.Errorf("invalid SAN: %w", err)
    }

    if err := position.Move(move); err != nil {
        return nil, fmt.Errorf("illegal move: %w", err)
    }

    newFEN, _ := position.MarshalText()

    return &ValidatedMove{
        SAN:       san,
        FEN:       string(newFEN),
        Piece:     move.Piece.String(),
        From:      move.From.String(),
        To:        move.To.String(),
        IsCheck:   position.InCheck(),
        IsCheckmate: position.IsCheckmate(),
    }, nil
}

// ValidatedMove represents a validated move
type ValidatedMove struct {
    SAN           string
    FEN           string
    Piece         string
    From          string
    To            string
    IsCheck       bool
    IsCheckmate   bool
    IsPromotion   bool
    PromotionTo   string
}

// GenerateFENAfterMove returns the FEN after playing a SAN move
func (s *ChessService) GenerateFENAfterMove(fen, san string) (string, error) {
    validated, err := s.ValidateMove(fen, san)
    if err != nil {
        return "", err
    }
    return validated.FEN, nil
}

// GetLegalMoves returns all legal SAN moves from a position
func (s *ChessService) GetLegalMoves(fen string) ([]string, error) {
    position := chess.NewPosition()
    if err := position.UnmarshalText([]byte(fen)); err != nil {
        return nil, fmt.Errorf("invalid FEN: %w", err)
    }

    moves := position.ValidMoves()
    sanMoves := make([]string, len(moves))
    for i, move := range moves {
        sanMoves[i] = move.String()
    }

    return sanMoves, nil
}
```

### 3.4 Frontend PGN Parser

**File: `src/utils/pgnParser.ts`**

```typescript
export interface PGNHeaders {
  Event?: string;
  Site?: string;
  Date?: string;
  Round?: string;
  White?: string;
  Black?: string;
  Result?: string;
  ECO?: string;
}

export interface PGNGame {
  headers: PGNHeaders;
  moves: string[];
  result?: string;
}

export class PGNParser {
  /**
   * Parse PGN content into games
   */
  static parse(content: string): PGNGame[] {
    const games: PGNGame[] = [];
    
    // Split into game blocks
    const blocks = this.splitGames(content);
    
    for (const block of blocks) {
      if (!block.trim()) continue;
      
      const game = this.parseGame(block);
      if (game) {
        games.push(game);
      }
    }
    
    return games;
  }

  /**
   * Split content into individual game blocks
   */
  private static splitGames(content: string): string[] {
    // Match result markers followed by [Event or end of string
    const regex = /(?:\d+-\d+|\d\/\d-\d\/\d|\*)\s*(?=\[Event|$)/g;
    const parts = content.split(regex);
    
    return parts.filter(p => p.trim().length > 0);
  }

  /**
   * Parse a single game
   */
  private static parseGame(block: string): PGNGame | null {
    const lines = block.split('\n');
    const headers: PGNHeaders = {};
    const moves: string[] = [];
    let inHeaders = true;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (inHeaders && trimmed.startsWith('[')) {
        const match = trimmed.match(/\[(\w+)\s+"([^"]*)"\]/);
        if (match) {
          headers[match[1] as keyof PGNHeaders] = match[2];
        }
        continue;
      }
      
      if (inHeaders && trimmed === '') {
        inHeaders = false;
        continue;
      }
      
      if (!inHeaders) {
        const lineMoves = this.parseMoveLine(trimmed);
        moves.push(...lineMoves);
      }
    }
    
    return {
      headers,
      moves,
      result: headers.Result,
    };
  }

  /**
   * Parse moves from a line, removing comments and variations
   */
  private static parseMoveLine(line: string): string[] {
    // Remove comments {...}
    let cleaned = line.replace(/\{[^}]*\}/g, '');
    // Remove variations (...)
    cleaned = cleaned.replace(/\([^)]*\)/g, '');
    // Remove NAGs ($1, $2, etc.)
    cleaned = cleaned.replace(/\$\d+/g, '');
    // Remove result markers at the end
    cleaned = cleaned.replace(/\s*(?:1-0|0-1|1\/2-1\/2|\*)\s*$/, '');
    
    // Split by whitespace
    const tokens = cleaned.trim().split(/\s+/);
    
    // Filter out move numbers (1., 2., etc.)
    return tokens.filter(t => !/^\d+\.$/.test(t));
  }

  /**
   * Validate SAN format (basic validation)
   */
  static isValidSAN(san: string): boolean {
    // Basic patterns for SAN moves
    const patterns = [
      /^[KQRBN]?[a-h]?[1-8]?[x-]?[a-h][1-8](?:=[QRBN])?[\+#]?$/, // Piece moves
      /^O-O-O[\+#]?$/, // Queenside castling
      /^O-O[\+#]?$/,   // Kingside castling
    ];
    
    return patterns.some(p => p.test(san));
  }
}
```

---

## 4. Transposition Handling Policy

### 4.1 Definition

A transposition occurs when the same position is reached through different move orders.

Example:
```
1. e4 e5 2. Nf3 = 1. Nf3 e5 2. e4
```

Both reach position after 2...e5 with White to play.

### 4.2 Policy for MVP

**For simplicity, transpositions are NOT merged automatically.**

Each path through the tree is kept as-is. If the user adds:
- 1.e4 e5 2.Nf3 → creates path "e4 → c5 → Nf3"
- 1.Nf3 c5 2.e4 → creates separate path "Nf3 → c5 → e4"

Both paths lead to the same position but are stored as separate branches.

**Rationale:**
- Simpler implementation
- Matches user's actual game experience
- User can choose to merge manually if desired

**Future (V2):** Add option to merge transpositions automatically.

---

## 5. Promotion Handling

### 5.1 Default Behavior

When a pawn promotion is encountered without explicit promotion piece:
- Default to Queen promotion (most common)
- Log a warning in development

### 5.2 Frontend Input

When user plays a move to the 8th/1st rank:
- If pawn reaches promotion rank, show promotion dialog
- Allow user to choose Q, R, B, N
- If no choice made, default to Queen

### 5.3 Backend Storage

Store the full SAN with promotion:
- `e8=Q` for Queen
- `e8=R` for Rook
- `e8=B` for Bishop
- `e8=N` for Knight

---

## 6. Castling Handling

### 6.1 SAN Notation

- `O-O` for kingside castling
- `O-O-O` for queenside castling

### 6.2 FEN Update

When castling occurs:
- King's position updates (e1 → g1 for O-O)
- Rook's position updates (h1 → f1 for O-O)
- Castling rights are updated in FEN

### 6.3 Validation

Castling is only legal if:
- King and rook have not moved
- No pieces between king and rook
- King is not in check
- King does not pass through check
- King does not land in check

---

## 7. Testing

### 7.1 Unit Tests

```typescript
// src/utils/__tests__/chessValidator.test.ts
import { ChessValidator } from '../chessValidator';

describe('ChessValidator', () => {
  test('validates e4 correctly', () => {
    const validator = new ChessValidator();
    const result = validator.validateMove('e4');
    expect(result).not.toBeNull();
    expect(result?.san).toBe('e4');
  });

  test('rejects illegal move', () => {
    const validator = new ChessValidator();
    const result = validator.validateMove('e5'); // Invalid from starting position
    expect(result).toBeNull();
  });

  test('handles castling', () => {
    const validator = new ChessValidator();
    validator.validateMove('e4');
    validator.validateMove('e5');
    validator.validateMove('Ke2'); // Move king first (not real castling)
    // ... need proper castling setup
  });
});
```

---

## 8. Dependencies to Other Epics

- Backend API (Epic 2) uses this for PGN import validation
- Frontend Core (Epic 4) uses this for move input validation
- PGN Import (Epic 7) uses this for analyzing games against repertoire

---

## 9. Notes

### 9.1 Go Chess Library

For Go, consider using:
- `github.com/notnil/chess` - Most popular and maintained
- `github.com/Eyevinn/go-chess` - Alternative

### 9.2 TypeScript Chess Library

Use `chess.js`:
```bash
npm install chess.js@beta
```

### 9.3 FEN Format

The FEN string includes 6 fields:
```
<piece placement>/<active color>/<castling rights>/<en passant>/<halfmove>/<fullmove>
```

Example: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`
