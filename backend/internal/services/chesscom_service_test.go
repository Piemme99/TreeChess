package services

import (
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
)

// captureTransport records the path of the first outbound request and returns
// a canned 404 so FetchGames short-circuits with ErrChesscomUserNotFound.
type captureTransport struct {
	path    string
	rawPath string
}

func (t *captureTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	t.path = req.URL.Path
	t.rawPath = req.URL.EscapedPath()
	return &http.Response{
		StatusCode: http.StatusNotFound,
		Body:       io.NopCloser(strings.NewReader("")),
		Header:     make(http.Header),
		Request:    req,
	}, nil
}

func TestChesscomService_FetchGames_PathEscapesUsername(t *testing.T) {
	cases := []struct {
		name     string
		username string
		// notWantSegment asserts the decoded path does not contain a segment
		// that would only appear if the username broke out of its path slot.
		mustEscape string
	}{
		{"slash", "evil/games/archives", "%2F"},
		{"dotdot", "../../admin", "%2F"},
		{"query", "user?x=1", "%3F"},
		{"hash", "user#frag", "%23"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			transport := &captureTransport{}
			svc := NewChesscomService()
			svc.httpClient.Transport = transport

			_, err := svc.FetchGames(tc.username, models.ChesscomImportOptions{})
			require.ErrorIs(t, err, ErrChesscomUserNotFound)

			// The escaped path must keep the username confined to a single
			// segment between "/player/" and "/games/archives".
			assert.True(t, strings.HasPrefix(transport.rawPath, "/pub/player/"),
				"path should start with /pub/player/, got %q", transport.rawPath)
			assert.True(t, strings.HasSuffix(transport.rawPath, "/games/archives"),
				"path should end with /games/archives, got %q", transport.rawPath)
			assert.Contains(t, transport.rawPath, tc.mustEscape,
				"reserved characters in the username must be percent-encoded")
		})
	}
}

func TestChesscomService_FetchGames_RejectsEmptyUsername(t *testing.T) {
	svc := NewChesscomService()
	_, err := svc.FetchGames("", models.ChesscomImportOptions{})
	require.Error(t, err)
}
