package services

import (
	"sort"
	"strconv"
	"strings"
)

// DefaultExplorerSpeeds and DefaultExplorerRatings are the query parameters
// used by both the Training tab and the engine worker. Aligning them keeps
// the cache-key space bounded and lets the worker piggyback on cache fills
// driven by user requests.
var (
	DefaultExplorerSpeeds  = []string{"blitz", "rapid", "classical"}
	DefaultExplorerRatings = []int{1600, 1800, 2000, 2200, 2500}
)

// CanonicalKey returns a stable cache key for an opening query. Order of
// speeds/ratings inside the slice does not matter — the key sorts them.
func CanonicalKey(q OpeningQuery) string {
	speeds := append([]string{}, q.Speeds...)
	ratings := append([]int{}, q.Ratings...)
	sort.Strings(speeds)
	sort.Ints(ratings)

	rs := make([]string, len(ratings))
	for i, r := range ratings {
		rs[i] = strconv.Itoa(r)
	}
	return strings.Join([]string{
		"v=" + q.Variant,
		"f=" + q.FEN,
		"s=" + strings.Join(speeds, ","),
		"r=" + strings.Join(rs, ","),
	}, "&")
}

// DefaultOpeningQuery returns an OpeningQuery for the given FEN with the
// project-wide default variant/speeds/ratings.
func DefaultOpeningQuery(fen string) OpeningQuery {
	return OpeningQuery{
		FEN:     fen,
		Variant: "standard",
		Speeds:  append([]string{}, DefaultExplorerSpeeds...),
		Ratings: append([]int{}, DefaultExplorerRatings...),
	}
}
