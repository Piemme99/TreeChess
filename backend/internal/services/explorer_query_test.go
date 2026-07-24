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

func TestCanonicalKey_IgnoresMoveCounters(t *testing.T) {
	// The handler keys on raw client FENs (real halfmove/fullmove counters,
	// or even 4-field node FENs) while the engine worker keys on
	// ensureFullFEN output ("... 0 1"). Same position must yield one key.
	base := "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -"
	fromClient := CanonicalKey(OpeningQuery{FEN: base + " 0 2", Variant: "standard"})
	fromWorker := CanonicalKey(OpeningQuery{FEN: base + " 0 1", Variant: "standard"})
	fourField := CanonicalKey(OpeningQuery{FEN: base, Variant: "standard"})
	assert.Equal(t, fromClient, fromWorker)
	assert.Equal(t, fromClient, fourField)
}

func TestCanonicalKey_DoesNotMutateInput(t *testing.T) {
	q := OpeningQuery{FEN: "x", Variant: "standard", Speeds: []string{"rapid", "blitz"}, Ratings: []int{2200, 1600}}
	_ = CanonicalKey(q)
	assert.Equal(t, []string{"rapid", "blitz"}, q.Speeds, "must not sort caller's slice in place")
	assert.Equal(t, []int{2200, 1600}, q.Ratings)
}
