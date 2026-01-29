// Package recognition provides chess position recognition from video frames
// using OpenCV template matching. It detects chessboards in images, extracts
// piece templates from a known starting position, and recognizes pieces on
// subsequent frames using normalized inverse MSE scoring.
package recognition

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"

	"gocv.io/x/gocv"
)

// RecognizedPosition holds the recognition result for a single frame.
type RecognizedPosition struct {
	FrameIndex       int     `json:"frameIndex"`
	TimestampSeconds float64 `json:"timestampSeconds"`
	FEN              string  `json:"fen"`
	Confidence       float64 `json:"confidence"`
	BoardDetected    bool    `json:"boardDetected"`
}

// Result holds the complete recognition output for all frames.
type Result struct {
	Positions       []RecognizedPosition `json:"positions"`
	TotalFrames     int                  `json:"totalFrames"`
	FramesWithBoard int                  `json:"framesWithBoard"`
}

// ProgressFunc is called to report recognition progress.
type ProgressFunc func(processedFrames, totalFrames int)

// frameEntry pairs a frame index with its file path.
type frameEntry struct {
	index int
	path  string
}

var framePattern = regexp.MustCompile(`^frame_(\d+)\.(png|jpg|jpeg)$`)

// getSortedFrames returns frame files sorted by frame number.
func getSortedFrames(framesDir string) ([]frameEntry, error) {
	entries, err := os.ReadDir(framesDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read frames directory: %w", err)
	}

	var frames []frameEntry
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		matches := framePattern.FindStringSubmatch(entry.Name())
		if matches == nil {
			continue
		}
		idx, _ := strconv.Atoi(matches[1])
		frames = append(frames, frameEntry{
			index: idx,
			path:  filepath.Join(framesDir, entry.Name()),
		})
	}

	sort.Slice(frames, func(i, j int) bool {
		return frames[i].index < frames[j].index
	})

	return frames, nil
}

// RecognizeFrames processes all frames in framesDir and returns recognized positions.
// It follows a three-phase pipeline:
//  1. Find board region in the first frames
//  2. Extract piece templates assuming starting position
//  3. Process all frames with change detection
func RecognizeFrames(ctx context.Context, framesDir string, onProgress ProgressFunc) (*Result, error) {
	frames, err := getSortedFrames(framesDir)
	if err != nil {
		return nil, err
	}
	totalFrames := len(frames)
	if totalFrames == 0 {
		return nil, fmt.Errorf("no frame files found in %s", framesDir)
	}

	// Phase 1: Find board region in the first frames
	boardSearchLimit := 10
	if boardSearchLimit > totalFrames {
		boardSearchLimit = totalFrames
	}

	var boardRegion *region
	var firstBoardImg gocv.Mat
	foundBoard := false

	for i := 0; i < boardSearchLimit; i++ {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}

		img := gocv.IMRead(frames[i].path, gocv.IMReadGrayScale)
		if img.Empty() {
			img.Close()
			continue
		}

		reg, score := detectBoardRegion(img)
		if reg != nil && score > 0.3 {
			boardRegion = reg
			firstBoardImg = img
			foundBoard = true
			break
		}
		img.Close()
	}

	if !foundBoard {
		return &Result{
			Positions:       []RecognizedPosition{},
			TotalFrames:     totalFrames,
			FramesWithBoard: 0,
		}, nil
	}
	defer firstBoardImg.Close()

	// Phase 2: Extract templates from the first detected board
	boardCrop := firstBoardImg.Region(boardRegion.toRect())
	defer boardCrop.Close()

	templates, cellSize, margins := extractTemplates(boardCrop, startingFENBoard)
	refs := buildReferenceTemplates(templates)
	defer refs.Close()
	// Close raw templates (no longer needed after building references)
	for _, samples := range templates {
		for _, s := range samples {
			s.Close()
		}
	}

	// Phase 3: Process all frames with change detection
	positions := make([]RecognizedPosition, 0, totalFrames)
	framesWithBoard := 0

	var prevBoardArray gocv.Mat
	hasPrev := false
	prevFEN := ""
	prevConfidence := 0.0

	defer func() {
		if hasPrev {
			prevBoardArray.Close()
		}
	}()

	for i, frame := range frames {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}

		timestampSeconds := float64(frame.index)

		img := gocv.IMRead(frame.path, gocv.IMReadGrayScale)
		if img.Empty() {
			img.Close()
			positions = append(positions, RecognizedPosition{
				FrameIndex:       frame.index,
				TimestampSeconds: timestampSeconds,
				FEN:              "",
				Confidence:       0.0,
				BoardDetected:    false,
			})
			continue
		}

		currBoardArray := img.Region(boardRegion.toRect())

		if hasPrev && !boardChanged(prevBoardArray, currBoardArray, 5.0) {
			// Board hasn't changed — reuse previous FEN
			positions = append(positions, RecognizedPosition{
				FrameIndex:       frame.index,
				TimestampSeconds: timestampSeconds,
				FEN:              prevFEN,
				Confidence:       prevConfidence,
				BoardDetected:    prevFEN != "",
			})
			if prevFEN != "" {
				framesWithBoard++
			}
			currBoardArray.Close()
			img.Close()
		} else {
			// Board changed — run template matching
			fenBoard := recognizeBoardOpenCV(currBoardArray, refs, cellSize, margins)

			var fen string
			var confidence float64
			var boardDetected bool

			if fenBoard != "" && countSlashes(fenBoard) == 7 {
				fen = fenBoard + " w KQkq -"
				confidence = 1.0
				boardDetected = true
			}

			positions = append(positions, RecognizedPosition{
				FrameIndex:       frame.index,
				TimestampSeconds: timestampSeconds,
				FEN:              fen,
				Confidence:       confidence,
				BoardDetected:    boardDetected,
			})

			if hasPrev {
				prevBoardArray.Close()
			}
			prevBoardArray = currBoardArray.Clone()
			hasPrev = true
			prevFEN = fen
			prevConfidence = confidence

			currBoardArray.Close()
			img.Close()

			if boardDetected {
				framesWithBoard++
			}
		}

		// Report progress
		if onProgress != nil && ((i+1)%5 == 0 || i == totalFrames-1) {
			onProgress(i+1, totalFrames)
		}
	}

	return &Result{
		Positions:       positions,
		TotalFrames:     totalFrames,
		FramesWithBoard: framesWithBoard,
	}, nil
}

func countSlashes(s string) int {
	n := 0
	for _, c := range s {
		if c == '/' {
			n++
		}
	}
	return n
}
