package services

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCanonicalKey_OrderInsensitive(t *testing.T) {
	a := CanonicalKey(OpeningQuery{FEN: "x", Variant: "standard", Speeds: []string{"rapid", "blitz"}, Ratings: []int{2200, 1600}})
	b := CanonicalKey(OpeningQuery{FEN: "x", Variant: "standard", Speeds: []string{"blitz", "rapid"}, Ratings: []int{1600, 2200}})
	assert.Equal(t, a, b)
}

func TestCanonicalKey_DifferentFenDifferentKey(t *testing.T) {
	a := CanonicalKey(OpeningQuery{FEN: "fen-1", Variant: "standard"})
	b := CanonicalKey(OpeningQuery{FEN: "fen-2", Variant: "standard"})
	assert.NotEqual(t, a, b)
}

func TestCanonicalKey_DoesNotMutateInput(t *testing.T) {
	q := OpeningQuery{FEN: "x", Variant: "standard", Speeds: []string{"rapid", "blitz"}, Ratings: []int{2200, 1600}}
	_ = CanonicalKey(q)
	assert.Equal(t, []string{"rapid", "blitz"}, q.Speeds, "must not sort caller's slice in place")
	assert.Equal(t, []int{2200, 1600}, q.Ratings)
}
