package recognition

import (
	"gocv.io/x/gocv"
)

// boardChanged detects if the board has changed between two frames.
// Uses mean absolute difference with the given threshold (typically 5.0).
func boardChanged(prev, curr gocv.Mat, threshold float64) bool {
	if prev.Empty() {
		return true
	}
	if prev.Rows() != curr.Rows() || prev.Cols() != curr.Cols() {
		return true
	}

	diff := gocv.NewMat()
	defer diff.Close()
	if err := gocv.AbsDiff(prev, curr, &diff); err != nil {
		return true // Treat errors as changed
	}

	mean := diff.Mean()
	// For grayscale images, only the first channel matters
	return mean.Val1 > threshold
}
