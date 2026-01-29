package recognition

import (
	"image"
	"math"

	"gocv.io/x/gocv"
)

// region represents a rectangular area in an image.
type region struct {
	X1, Y1, X2, Y2 int
}

func (r *region) toRect() image.Rectangle {
	return image.Rect(r.X1, r.Y1, r.X2, r.Y2)
}

// detectBoardRegion scans the image at multiple scales to find the best
// checkerboard region. Returns the region and its score, or nil if no
// board is found with score > 0.3.
func detectBoardRegion(img gocv.Mat) (*region, float64) {
	h := img.Rows()
	w := img.Cols()

	var bestRegion *region
	bestScore := 0.0

	scales := []float64{0.8, 0.6, 0.5, 0.4, 0.3}
	minDim := h
	if w < minDim {
		minDim = w
	}

	for _, scale := range scales {
		size := int(float64(minDim) * scale)
		if size < 100 {
			continue
		}

		step := size / 4
		if step < 1 {
			step = 1
		}

		for yOff := 0; yOff <= h-size; yOff += step {
			for xOff := 0; xOff <= w-size; xOff += step {
				sub := img.Region(image.Rect(xOff, yOff, xOff+size, yOff+size))
				score := computeCheckerboardScore(sub)
				sub.Close()

				if score > bestScore {
					bestScore = score
					bestRegion = &region{xOff, yOff, xOff + size, yOff + size}
				}
			}
		}
	}

	if bestRegion != nil && bestScore > 0.3 {
		refined := refineBoardRegion(img, bestRegion)
		if refined != nil {
			return refined, bestScore
		}
		return bestRegion, bestScore
	}

	return nil, 0.0
}

// refineBoardRegion expands a detected sub-region to cover the full 8x8 board.
// The initial detection often finds only the center rows because empty squares
// score higher. This estimates cell size and searches for the best 8x8 alignment.
func refineBoardRegion(img gocv.Mat, reg *region) *region {
	detW := reg.X2 - reg.X1
	detH := reg.Y2 - reg.Y1
	h := img.Rows()
	w := img.Cols()

	cx := float64(reg.X1+reg.X2) / 2.0
	cy := float64(reg.Y1+reg.Y2) / 2.0

	var bestCandidate *region
	bestScore := -1.0

	for nCells := 4; nCells <= 7; nCells++ {
		cellSize := float64(detW) / float64(nCells)
		if cellSize < 10 {
			continue
		}

		fullSize := int(math.Round(cellSize * 8))
		searchRange := int(cellSize * 1.5)
		searchStep := int(cellSize / 4)
		if searchStep < 1 {
			searchStep = 1
		}

		for dy := -searchRange; dy <= searchRange; dy += searchStep {
			for dx := -searchRange; dx <= searchRange; dx += searchStep {
				candX1 := int(math.Round(cx + float64(dx) - float64(fullSize)/2.0))
				candY1 := int(math.Round(cy + float64(dy) - float64(fullSize)/2.0))
				candX2 := candX1 + fullSize
				candY2 := candY1 + fullSize

				if candX1 < 0 || candY1 < 0 || candX2 > w || candY2 > h {
					continue
				}

				candidate := img.Region(image.Rect(candX1, candY1, candX2, candY2))
				score := computeCheckerboardScore(candidate)
				candidate.Close()

				if score > bestScore {
					bestScore = score
					bestCandidate = &region{candX1, candY1, candX2, candY2}
				}
			}
		}
	}

	if bestCandidate == nil || bestScore < 0.3 {
		return nil
	}

	// Only return expanded region if actually larger
	origArea := detW * detH
	newArea := (bestCandidate.X2 - bestCandidate.X1) * (bestCandidate.Y2 - bestCandidate.Y1)
	if newArea <= origArea {
		return nil
	}

	return bestCandidate
}

// computeCheckerboardScore scores how likely a region contains a checkerboard pattern.
// It divides the region into an 8x8 grid and checks brightness differences between
// adjacent cells. Returns a score between 0.0 and 1.0.
func computeCheckerboardScore(reg gocv.Mat) float64 {
	h := reg.Rows()
	w := reg.Cols()
	cellH := h / 8
	cellW := w / 8

	if cellH < 5 || cellW < 5 {
		return 0.0
	}

	// Clone if non-continuous (region sub-matrix)
	mat := reg
	needClose := false
	if !reg.IsContinuous() {
		mat = reg.Clone()
		needClose = true
	}
	if needClose {
		defer mat.Close()
	}

	// Compute mean brightness per cell using pixel data
	data, err := mat.DataPtrUint8()
	if err != nil {
		return 0.0
	}

	var means [8][8]float64
	for r := 0; r < 8; r++ {
		for c := 0; c < 8; c++ {
			var sum float64
			count := 0
			for y := r * cellH; y < (r+1)*cellH; y++ {
				rowStart := y * w
				for x := c * cellW; x < (c+1)*cellW; x++ {
					sum += float64(data[rowStart+x])
					count++
				}
			}
			if count > 0 {
				means[r][c] = sum / float64(count)
			}
		}
	}

	score := 0
	count := 0

	// Horizontal adjacency
	for r := 0; r < 8; r++ {
		for c := 0; c < 7; c++ {
			if math.Abs(means[r][c]-means[r][c+1]) > 20 {
				score++
			}
			count++
		}
	}

	// Vertical adjacency
	for r := 0; r < 7; r++ {
		for c := 0; c < 8; c++ {
			if math.Abs(means[r][c]-means[r+1][c]) > 20 {
				score++
			}
			count++
		}
	}

	if count == 0 {
		return 0.0
	}
	return float64(score) / float64(count)
}
