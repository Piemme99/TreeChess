package recognition

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestComputeInverseMSE_Identical(t *testing.T) {
	a := []float32{100, 150, 200, 50, 0, 255}
	b := []float32{100, 150, 200, 50, 0, 255}

	score := computeInverseMSE(a, b)
	assert.InDelta(t, 1.0, float64(score), 0.0001, "identical arrays should give score ~1.0")
}

func TestComputeInverseMSE_Opposite(t *testing.T) {
	// All 0 vs all 255 → MSE = 255^2 → score = 1 - 255^2/255^2 = 0
	a := make([]float32, 100)
	b := make([]float32, 100)
	for i := range b {
		b[i] = 255
	}

	score := computeInverseMSE(a, b)
	assert.InDelta(t, 0.0, float64(score), 0.0001, "max difference should give score ~0.0")
}

func TestComputeInverseMSE_PartialMatch(t *testing.T) {
	a := []float32{100, 100, 100, 100}
	b := []float32{110, 110, 110, 110}

	score := computeInverseMSE(a, b)
	// MSE = (10^2) = 100, normalized = 100 / 65025 ≈ 0.00154
	// Score = 1 - 0.00154 ≈ 0.998
	assert.True(t, score > 0.99, "small difference should give high score, got %f", score)
	assert.True(t, score < 1.0, "not identical so should be < 1.0")
}

func TestComputeInverseMSE_Empty(t *testing.T) {
	score := computeInverseMSE([]float32{}, []float32{})
	assert.Equal(t, float32(0), score, "empty slices should return 0")
}

func TestComputeInverseMSE_DifferentLengths(t *testing.T) {
	a := []float32{100, 100, 100, 100, 100}
	b := []float32{100, 100, 100}

	// Should use min(len(a), len(b)) = 3
	score := computeInverseMSE(a, b)
	assert.InDelta(t, 1.0, float64(score), 0.0001, "matching values should score 1.0 even with different lengths")
}

func TestComputeInverseMSE_MidRange(t *testing.T) {
	// Half the pixels differ by 127.5 → MSE = 127.5^2 / 2 ≈ 8128
	a := []float32{0, 0, 255, 255}
	b := []float32{255, 255, 255, 255}

	score := computeInverseMSE(a, b)
	// MSE = (255^2 + 255^2 + 0 + 0) / 4 = 130050 / 4 = 32512.5
	// Score = 1 - 32512.5 / 65025 = 1 - 0.5 = 0.5
	assert.InDelta(t, 0.5, float64(score), 0.001, "half max difference should give ~0.5")
}
