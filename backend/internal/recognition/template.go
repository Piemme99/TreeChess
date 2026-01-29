package recognition

import (
	"image"

	"gocv.io/x/gocv"
)

// startingFENBoard is the standard starting position used for template extraction.
const startingFENBoard = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"

// fenPieceMap maps FEN characters to piece names.
var fenPieceMap = map[byte]string{
	'r': "b_rook", 'n': "b_knight", 'b': "b_bishop", 'q': "b_queen",
	'k': "b_king", 'p': "b_pawn",
	'R': "w_rook", 'N': "w_knight", 'B': "w_bishop", 'Q': "w_queen",
	'K': "w_king", 'P': "w_pawn",
}

// pieceFENMap maps piece names to FEN characters.
var pieceFENMap map[string]byte

func init() {
	pieceFENMap = make(map[string]byte, len(fenPieceMap))
	for k, v := range fenPieceMap {
		pieceFENMap[v] = k
	}
}

// templateKey identifies a template by piece name and square color.
type templateKey struct {
	pieceName   string
	squareColor string // "light" or "dark"
}

// cellSize holds the cell dimensions.
type cellSize struct {
	h, w int
}

// margins holds the crop margins used to avoid cell borders.
type margins struct {
	y, x int
}

// ReferenceTemplates holds the averaged reference templates for recognition.
// Call Close() when done to release memory.
type ReferenceTemplates struct {
	refs map[templateKey][]float32
	rows int
	cols int
}

// Close releases memory (float32 slices are GC'd, this is a no-op but keeps the pattern).
func (rt *ReferenceTemplates) Close() {
	rt.refs = nil
}

// extractTemplates extracts piece templates from a board image given a known FEN position.
// Returns raw templates keyed by (piece_name, square_color), cell size, and margins.
func extractTemplates(boardImage gocv.Mat, fenBoard string) (map[templateKey][]gocv.Mat, cellSize, margins) {
	grid := parseFENBoard(fenBoard)
	h := boardImage.Rows()
	w := boardImage.Cols()
	cH := h / 8
	cW := w / 8

	marginY := cH / 8
	if marginY < 1 {
		marginY = 1
	}
	marginX := cW / 8
	if marginX < 1 {
		marginX = 1
	}

	templates := make(map[templateKey][]gocv.Mat)

	for r := 0; r < 8; r++ {
		for c := 0; c < 8; c++ {
			pieceName := "empty"
			if grid[r][c] != 0 {
				pieceName = fenPieceMap[grid[r][c]]
			}

			sqColor := "light"
			if (r+c)%2 != 0 {
				sqColor = "dark"
			}

			y1 := r*cH + marginY
			y2 := (r+1)*cH - marginY
			x1 := c*cW + marginX
			x2 := (c+1)*cW - marginX

			cell := boardImage.Region(image.Rect(x1, y1, x2, y2))
			cellClone := cell.Clone()
			cell.Close()

			key := templateKey{pieceName, sqColor}
			templates[key] = append(templates[key], cellClone)
		}
	}

	return templates, cellSize{cH, cW}, margins{marginY, marginX}
}

// buildReferenceTemplates builds averaged reference templates from raw samples.
// Synthesizes missing square-color variants using a brightness delta.
// The returned ReferenceTemplates stores templates as float32 slices for fast MSE.
func buildReferenceTemplates(templates map[templateKey][]gocv.Mat) *ReferenceTemplates {
	refs := &ReferenceTemplates{
		refs: make(map[templateKey][]float32),
	}

	// First pass: average all samples per key
	averages := make(map[templateKey][]float32)
	for key, samples := range templates {
		if len(samples) == 0 {
			continue
		}
		targetRows := samples[0].Rows()
		targetCols := samples[0].Cols()
		refs.rows = targetRows
		refs.cols = targetCols
		size := targetRows * targetCols

		avg := make([]float64, size)
		for _, s := range samples {
			data, err := s.DataPtrUint8()
			if err != nil {
				continue
			}
			// Resize if needed
			if s.Rows() != targetRows || s.Cols() != targetCols {
				resized := gocv.NewMat()
				if err := gocv.Resize(s, &resized, image.Pt(targetCols, targetRows), 0, 0, gocv.InterpolationLinear); err != nil {
					resized.Close()
					continue
				}
				d2, err := resized.DataPtrUint8()
				if err != nil {
					resized.Close()
					continue
				}
				for j := 0; j < size && j < len(d2); j++ {
					avg[j] += float64(d2[j])
				}
				resized.Close()
			} else {
				for j := 0; j < size && j < len(data); j++ {
					avg[j] += float64(data[j])
				}
			}
		}

		n := float64(len(samples))
		result := make([]float32, size)
		for j := range avg {
			result[j] = float32(avg[j] / n)
		}
		averages[key] = result
	}

	// Copy averages to refs
	for key, val := range averages {
		refs.refs[key] = val
	}

	// Compute brightness delta from empty square templates
	var brightnessDelta float32
	emptyLight, hasLight := averages[templateKey{"empty", "light"}]
	emptyDark, hasDark := averages[templateKey{"empty", "dark"}]
	if hasLight && hasDark {
		var sumLight, sumDark float32
		for i := range emptyLight {
			sumLight += emptyLight[i]
			sumDark += emptyDark[i]
		}
		n := float32(len(emptyLight))
		brightnessDelta = sumLight/n - sumDark/n
	}

	// Collect all piece names
	pieceNames := make(map[string]bool)
	for key := range averages {
		pieceNames[key.pieceName] = true
	}

	// Synthesize missing variants
	for pn := range pieceNames {
		_, hasL := averages[templateKey{pn, "light"}]
		_, hasD := averages[templateKey{pn, "dark"}]
		if hasL && !hasD {
			src := averages[templateKey{pn, "light"}]
			synth := make([]float32, len(src))
			for i, v := range src {
				val := v - brightnessDelta
				if val < 0 {
					val = 0
				}
				if val > 255 {
					val = 255
				}
				synth[i] = val
			}
			refs.refs[templateKey{pn, "dark"}] = synth
		} else if hasD && !hasL {
			src := averages[templateKey{pn, "dark"}]
			synth := make([]float32, len(src))
			for i, v := range src {
				val := v + brightnessDelta
				if val < 0 {
					val = 0
				}
				if val > 255 {
					val = 255
				}
				synth[i] = val
			}
			refs.refs[templateKey{pn, "light"}] = synth
		}
	}

	return refs
}
