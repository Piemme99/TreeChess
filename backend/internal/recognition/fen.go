package recognition

// parseFENBoard parses a FEN board string into an 8x8 grid of piece characters.
// Empty squares are represented as 0.
func parseFENBoard(fenBoard string) [8][8]byte {
	var grid [8][8]byte
	r, c := 0, 0

	for i := 0; i < len(fenBoard); i++ {
		ch := fenBoard[i]
		if ch == '/' {
			r++
			c = 0
			continue
		}
		if ch >= '1' && ch <= '8' {
			c += int(ch - '0')
			continue
		}
		if r < 8 && c < 8 {
			grid[r][c] = ch
			c++
		}
	}

	return grid
}

// gridToFEN converts an 8x8 grid of piece names to a FEN board string.
func gridToFEN(ranks [][]string) string {
	result := ""
	for i, rank := range ranks {
		if i > 0 {
			result += "/"
		}
		emptyCount := 0
		for _, pieceName := range rank {
			if pieceName == "empty" {
				emptyCount++
			} else {
				if emptyCount > 0 {
					result += string(rune('0' + emptyCount))
					emptyCount = 0
				}
				fenChar, ok := pieceFENMap[pieceName]
				if ok {
					result += string(fenChar)
				}
			}
		}
		if emptyCount > 0 {
			result += string(rune('0' + emptyCount))
		}
	}
	return result
}
