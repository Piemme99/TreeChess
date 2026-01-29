package recognition

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetSortedFrames_SortsCorrectly(t *testing.T) {
	dir := t.TempDir()

	// Create frame files in non-sorted order
	files := []string{"frame_000010.png", "frame_000001.png", "frame_000005.png", "frame_000003.jpg"}
	for _, f := range files {
		require.NoError(t, os.WriteFile(filepath.Join(dir, f), []byte("fake"), 0644))
	}

	frames, err := getSortedFrames(dir)
	require.NoError(t, err)
	require.Len(t, frames, 4)

	assert.Equal(t, 1, frames[0].index)
	assert.Equal(t, 3, frames[1].index)
	assert.Equal(t, 5, frames[2].index)
	assert.Equal(t, 10, frames[3].index)
}

func TestGetSortedFrames_FiltersNonFrames(t *testing.T) {
	dir := t.TempDir()

	files := []string{
		"frame_000001.png",
		"frame_000002.png",
		"not_a_frame.png",
		"readme.txt",
		"frame_abc.png", // invalid number
	}
	for _, f := range files {
		require.NoError(t, os.WriteFile(filepath.Join(dir, f), []byte("fake"), 0644))
	}

	frames, err := getSortedFrames(dir)
	require.NoError(t, err)
	assert.Len(t, frames, 2)
	assert.Equal(t, 1, frames[0].index)
	assert.Equal(t, 2, frames[1].index)
}

func TestGetSortedFrames_EmptyDir(t *testing.T) {
	dir := t.TempDir()

	frames, err := getSortedFrames(dir)
	require.NoError(t, err)
	assert.Empty(t, frames)
}

func TestGetSortedFrames_SkipsDirectories(t *testing.T) {
	dir := t.TempDir()

	require.NoError(t, os.WriteFile(filepath.Join(dir, "frame_000001.png"), []byte("fake"), 0644))
	require.NoError(t, os.Mkdir(filepath.Join(dir, "frame_000002.png"), 0755))

	frames, err := getSortedFrames(dir)
	require.NoError(t, err)
	assert.Len(t, frames, 1)
	assert.Equal(t, 1, frames[0].index)
}

func TestGetSortedFrames_NonExistentDir(t *testing.T) {
	_, err := getSortedFrames("/nonexistent/path")
	assert.Error(t, err)
}

func TestGetSortedFrames_JpegExtensions(t *testing.T) {
	dir := t.TempDir()

	files := []string{"frame_000001.png", "frame_000002.jpg", "frame_000003.jpeg"}
	for _, f := range files {
		require.NoError(t, os.WriteFile(filepath.Join(dir, f), []byte("fake"), 0644))
	}

	frames, err := getSortedFrames(dir)
	require.NoError(t, err)
	assert.Len(t, frames, 3)
}

func TestCountSlashes(t *testing.T) {
	tests := []struct {
		input    string
		expected int
	}{
		{"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", 7},
		{"8/8/8/8/8/8/8/8", 7},
		{"no slashes", 0},
		{"", 0},
		{"/", 1},
		{"a/b/c", 2},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			assert.Equal(t, tt.expected, countSlashes(tt.input))
		})
	}
}
