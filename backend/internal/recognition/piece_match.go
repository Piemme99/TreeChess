package recognition

import (
	"image"

	"gocv.io/x/gocv"
)

// recognizeBoardOpenCV recognizes pieces on all 64 squares using template matching.
// It uses normalized inverse MSE scoring: score = 1 - mean((a-b)^2) / 255^2.
// Returns a FEN board string (e.g. "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR").
func recognizeBoardOpenCV(boardImage gocv.Mat, refs *ReferenceTemplates, cs cellSize, m margins) string {
	ranks := make([][]string, 8)

	for r := 0; r < 8; r++ {
		rankPieces := make([]string, 8)
		for c := 0; c < 8; c++ {
			y1 := r*cs.h + m.y
			y2 := (r+1)*cs.h - m.y
			x1 := c*cs.w + m.x
			x2 := (c+1)*cs.w - m.x

			cellRegion := boardImage.Region(image.Rect(x1, y1, x2, y2))
			cell := cellRegion.Clone()
			cellRegion.Close()
			cellData, err := cell.DataPtrUint8()
			if err != nil {
				cell.Close()
				rankPieces[c] = "empty"
				continue
			}

			sqColor := "light"
			if (r+c)%2 != 0 {
				sqColor = "dark"
			}

			// Convert cell to float32 slice for MSE computation
			cellF32 := make([]float32, len(cellData))
			for i, v := range cellData {
				cellF32[i] = float32(v)
			}

			bestScore := float32(-2.0)
			bestPiece := "empty"

			for key, refTemplate := range refs.refs {
				if key.squareColor != sqColor {
					continue
				}

				ref := refTemplate

				// Resize reference if sizes don't match
				if len(ref) != len(cellF32) {
					refBytes := make([]byte, len(ref))
					for i, v := range ref {
						refBytes[i] = uint8(v)
					}
					refMat, err := gocv.NewMatFromBytes(refs.rows, refs.cols, gocv.MatTypeCV8U, refBytes)
					if err != nil {
						continue
					}
					resized := gocv.NewMat()
					if err := gocv.Resize(refMat, &resized, image.Pt(x2-x1, y2-y1), 0, 0, gocv.InterpolationLinear); err != nil {
						refMat.Close()
						resized.Close()
						continue
					}
					resizedData, err := resized.DataPtrUint8()
					if err != nil {
						refMat.Close()
						resized.Close()
						continue
					}
					ref = make([]float32, len(resizedData))
					for i, v := range resizedData {
						ref[i] = float32(v)
					}
					refMat.Close()
					resized.Close()
				}

				score := computeInverseMSE(cellF32, ref)
				if score > bestScore {
					bestScore = score
					bestPiece = key.pieceName
				}
			}

			cell.Close()
			rankPieces[c] = bestPiece
		}
		ranks[r] = rankPieces
	}

	return gridToFEN(ranks)
}

// computeInverseMSE computes normalized inverse MSE: 1 - mean((a-b)^2) / 255^2.
// Both slices must have the same length.
func computeInverseMSE(a, b []float32) float32 {
	n := len(a)
	if n == 0 {
		return 0
	}
	if len(b) < n {
		n = len(b)
	}

	var sumSqDiff float32
	for i := 0; i < n; i++ {
		d := a[i] - b[i]
		sumSqDiff += d * d
	}

	mse := sumSqDiff / float32(n)
	return 1.0 - mse/(255.0*255.0)
}
