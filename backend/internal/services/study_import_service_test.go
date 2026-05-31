package services

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository/mocks"
	smocks "github.com/kumquat/backend/internal/services/mocks"
)

// --- ParseStudyURL tests ---

func TestParseStudyURL_FullURL(t *testing.T) {
	studyID, chapterID, err := ParseStudyURL("https://lichess.org/study/abcdefgh")
	require.NoError(t, err)
	assert.Equal(t, "abcdefgh", studyID)
	assert.Empty(t, chapterID)
}

func TestParseStudyURL_FullURLWithChapter(t *testing.T) {
	studyID, chapterID, err := ParseStudyURL("https://lichess.org/study/abcdefgh/ijklmnop")
	require.NoError(t, err)
	assert.Equal(t, "abcdefgh", studyID)
	assert.Equal(t, "ijklmnop", chapterID)
}

func TestParseStudyURL_RawID(t *testing.T) {
	studyID, chapterID, err := ParseStudyURL("abcdefgh")
	require.NoError(t, err)
	assert.Equal(t, "abcdefgh", studyID)
	assert.Empty(t, chapterID)
}

func TestParseStudyURL_Empty(t *testing.T) {
	_, _, err := ParseStudyURL("")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "required")
}

func TestParseStudyURL_Invalid(t *testing.T) {
	_, _, err := ParseStudyURL("not-a-valid-url-or-id")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid")
}

func TestParseStudyURL_Trimmed(t *testing.T) {
	studyID, _, err := ParseStudyURL("  abcdefgh  ")
	require.NoError(t, err)
	assert.Equal(t, "abcdefgh", studyID)
}

// --- PreviewStudy tests ---

func TestStudyImportService_PreviewStudy_Success(t *testing.T) {
	pgnData := `[Event "My Study: Chapter 1"]
[Orientation "White"]

1. e4 e5 2. Nf3 *

[Event "My Study: Chapter 2"]
[Orientation "Black"]

1. d4 d5 *
`
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return pgnData, nil
		},
	}
	svc := NewStudyImportService(mockLichess, &smocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	info, err := svc.PreviewStudy("testid01", "")

	require.NoError(t, err)
	require.NotNil(t, info)
	assert.Equal(t, "testid01", info.StudyID)
	assert.Equal(t, "My Study", info.StudyName)
	assert.Len(t, info.Chapters, 2)
	assert.Equal(t, "Chapter 1", info.Chapters[0].Name)
	assert.Equal(t, "white", info.Chapters[0].Orientation)
	assert.Equal(t, "Chapter 2", info.Chapters[1].Name)
	assert.Equal(t, "black", info.Chapters[1].Orientation)
}

func TestStudyImportService_PreviewStudy_FetchError(t *testing.T) {
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return "", ErrLichessStudyNotFound
		},
	}
	svc := NewStudyImportService(mockLichess, &smocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	_, err := svc.PreviewStudy("testid01", "")

	assert.ErrorIs(t, err, ErrLichessStudyNotFound)
}

func TestStudyImportService_PreviewStudy_EmptyPGN(t *testing.T) {
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return "", nil
		},
	}
	svc := NewStudyImportService(mockLichess, &smocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	_, err := svc.PreviewStudy("testid01", "")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no chapters")
}

// --- ImportStudyChapters tests ---

func TestStudyImportService_ImportStudyChapters_Success(t *testing.T) {
	pgnData := `[Event "Study: Sicilian"]
[Orientation "White"]

1. e4 c5 *

[Event "Study: French"]
[Orientation "Black"]

1. e4 e6 *

[Event "Study: Caro-Kann"]
[Orientation "Black"]

1. e4 c6 *
`
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return pgnData, nil
		},
	}

	createdCount := 0
	mockRepSvc := &smocks.MockRepertoireService{
		CreateRepertoireFunc: func(_ context.Context, userID, name string, color models.Color) (*models.Repertoire, error) {
			createdCount++
			return &models.Repertoire{
				ID:    fmt.Sprintf("rep-%d", createdCount),
				Name:  name,
				Color: color,
			}, nil
		},
		SaveTreeFunc: func(_ context.Context, userID string, repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:       repertoireID,
				TreeData: treeData,
			}, nil
		},
	}

	svc := NewStudyImportService(mockLichess, mockRepSvc, &mocks.MockUserRepo{})
	reps, err := svc.ImportStudyChapters(context.Background(), "user-1", "testid01", "", []int{0, 2})

	require.NoError(t, err)
	assert.Len(t, reps, 2)
	assert.Equal(t, 2, createdCount)
}

func TestStudyImportService_ImportStudyChapters_FetchError(t *testing.T) {
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return "", ErrLichessStudyForbidden
		},
	}
	svc := NewStudyImportService(mockLichess, &smocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	_, err := svc.ImportStudyChapters(context.Background(), "user-1", "testid01", "", []int{0})

	assert.ErrorIs(t, err, ErrLichessStudyForbidden)
}

func TestStudyImportService_ImportStudyChapters_EmptyChapters(t *testing.T) {
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return "", nil
		},
	}
	svc := NewStudyImportService(mockLichess, &smocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	_, err := svc.ImportStudyChapters(context.Background(), "user-1", "testid01", "", []int{0})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no chapters")
}

// --- GetLichessTokenForUser tests ---

func TestStudyImportService_GetLichessTokenForUser_Found(t *testing.T) {
	token := "lip_test_token_123"
	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.User, error) {
			return &models.User{
				ID:                 id,
				LichessAccessToken: &token,
			}, nil
		},
	}
	svc := NewStudyImportService(&smocks.MockLichessService{}, &smocks.MockRepertoireService{}, mockUserRepo)

	result := svc.GetLichessTokenForUser(context.Background(), "user-1")

	assert.Equal(t, "lip_test_token_123", result)
}

func TestStudyImportService_GetLichessTokenForUser_NoToken(t *testing.T) {
	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.User, error) {
			return &models.User{
				ID:                 id,
				LichessAccessToken: nil,
			}, nil
		},
	}
	svc := NewStudyImportService(&smocks.MockLichessService{}, &smocks.MockRepertoireService{}, mockUserRepo)

	result := svc.GetLichessTokenForUser(context.Background(), "user-1")

	assert.Empty(t, result)
}

func TestStudyImportService_GetLichessTokenForUser_UserNotFound(t *testing.T) {
	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.User, error) {
			return nil, fmt.Errorf("not found")
		},
	}
	svc := NewStudyImportService(&smocks.MockLichessService{}, &smocks.MockRepertoireService{}, mockUserRepo)

	result := svc.GetLichessTokenForUser(context.Background(), "nonexistent")

	assert.Empty(t, result)
}

// --- Custom starting position handling ---

const studyPGNWithCustomStartingPositions = `[Event "Sicilian: Chapter 1"]
[Orientation "White"]

1. e4 c5 *

[Event "Sicilian: Chapter 2 (From Position)"]
[Orientation "White"]
[FEN "r1bqkbnr/pp1ppp1p/2n3p1/2p5/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1"]
[SetUp "1"]

1. Nc3 *

[Event "Sicilian: Chapter 3 (From Position)"]
[Orientation "White"]
[FEN "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w kq - 0 7"]
[SetUp "1"]

7. Nf3 *
`

func TestStudyImportService_PreviewStudy_FlagsCustomStartingPositionChapters(t *testing.T) {
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return studyPGNWithCustomStartingPositions, nil
		},
	}
	svc := NewStudyImportService(mockLichess, &smocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	info, err := svc.PreviewStudy("testid01", "")

	require.NoError(t, err)
	require.NotNil(t, info)
	require.Len(t, info.Chapters, 3)
	// Standard chapter: importable, not flagged.
	assert.True(t, info.Chapters[0].Importable)
	assert.False(t, info.Chapters[0].CustomStart)
	assert.Empty(t, info.Chapters[0].SkipReason)
	// Custom-start chapters: importable on their own, but flagged so the UI can
	// show they can't be merged into a standard repertoire.
	assert.True(t, info.Chapters[1].Importable)
	assert.True(t, info.Chapters[1].CustomStart)
	assert.Equal(t, models.SkipReasonCustomStartingPosition, info.Chapters[1].SkipReason)
	assert.True(t, info.Chapters[2].Importable)
	assert.True(t, info.Chapters[2].CustomStart)
	assert.Equal(t, models.SkipReasonCustomStartingPosition, info.Chapters[2].SkipReason)
}

func TestStudyImportService_ImportStudyChaptersWithCategory_ImportsCustomStart(t *testing.T) {
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return studyPGNWithCustomStartingPositions, nil
		},
	}
	createdCount := 0
	var savedTrees []models.RepertoireNode
	mockRepSvc := &smocks.MockRepertoireService{
		CreateRepertoireFunc: func(_ context.Context, userID, name string, color models.Color) (*models.Repertoire, error) {
			createdCount++
			return &models.Repertoire{ID: fmt.Sprintf("rep-%d", createdCount), Name: name, Color: color}, nil
		},
		SaveTreeFunc: func(_ context.Context, userID, repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error) {
			savedTrees = append(savedTrees, treeData)
			return &models.Repertoire{ID: repertoireID, TreeData: treeData}, nil
		},
	}
	svc := NewStudyImportService(mockLichess, mockRepSvc, &mocks.MockUserRepo{})

	result, err := svc.ImportStudyChaptersWithCategory(context.Background(), "user-1", "testid01", "", []int{0, 1, 2}, false, "", false, true, RenameStrategyAbort)

	require.NoError(t, err)
	require.NotNil(t, result)
	// Per-chapter import now imports custom-start chapters too, each rooted at
	// its own FEN — nothing is skipped.
	assert.Len(t, result.Repertoires, 3)
	assert.Empty(t, result.Skipped)

	// Each custom-start chapter is rooted at its (verbatim) starting FEN.
	require.Len(t, savedTrees, 3)
	assert.Equal(t, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", savedTrees[0].FEN)
	assert.Equal(t, "r1bqkbnr/pp1ppp1p/2n3p1/2p5/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -", savedTrees[1].FEN)
	// FEN is left untouched, including the non-standard "kq" castling rights.
	assert.Equal(t, "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w kq -", savedTrees[2].FEN)
}

func TestStudyImportService_ImportStudyChaptersMerged_ReturnsSkipped(t *testing.T) {
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return studyPGNWithCustomStartingPositions, nil
		},
	}
	mockRepSvc := &smocks.MockRepertoireService{
		CreateRepertoireFunc: func(_ context.Context, userID, name string, color models.Color) (*models.Repertoire, error) {
			return &models.Repertoire{ID: "rep-1", Name: name, Color: color}, nil
		},
		SaveTreeFunc: func(_ context.Context, userID, repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error) {
			return &models.Repertoire{ID: repertoireID, TreeData: treeData}, nil
		},
	}
	svc := NewStudyImportService(mockLichess, mockRepSvc, &mocks.MockUserRepo{})

	result, err := svc.ImportStudyChaptersMerged(context.Background(), "user-1", "testid01", "", []int{0, 1, 2}, "Merged", false, true, RenameStrategyAbort)

	require.NoError(t, err)
	require.NotNil(t, result)
	require.NotNil(t, result.Repertoire)
	require.Len(t, result.Skipped, 2)
	assert.Equal(t, 1, result.Skipped[0].Index)
	assert.Equal(t, 2, result.Skipped[1].Index)
}

func TestStudyImportService_ImportStudyChaptersMerged_AllChaptersSkipped(t *testing.T) {
	pgnAllCustom := `[Event "Study: Chapter A"]
[Orientation "White"]
[FEN "r1bqkbnr/pp1ppp1p/2n3p1/2p5/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1"]
[SetUp "1"]

1. Nc3 *

[Event "Study: Chapter B"]
[Orientation "White"]
[FEN "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w kq - 0 7"]
[SetUp "1"]

7. Nf3 *
`
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return pgnAllCustom, nil
		},
	}
	svc := NewStudyImportService(mockLichess, &smocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	_, err := svc.ImportStudyChaptersMerged(context.Background(), "user-1", "testid01", "", []int{0, 1}, "Merged", false, true, RenameStrategyAbort)

	assert.ErrorIs(t, err, ErrAllChaptersSkipped)
}

// --- Name conflict / rename strategy tests ---

const studyPGNForConflict = `[Event "Sicilian Study: Najdorf"]
[Orientation "White"]

1. e4 c5 2. Nf3 d6 *

[Event "Sicilian Study: Sveshnikov"]
[Orientation "White"]

1. e4 c5 2. Nf3 Nc6 *
`

func TestStudyImportService_ImportStudyChaptersWithCategory_AbortsOnConflict(t *testing.T) {
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) { return studyPGNForConflict, nil },
	}
	createdCount := 0
	mockRepSvc := &smocks.MockRepertoireService{
		ListRepertoiresFunc: func(_ context.Context, userID string, color *models.Color) ([]models.Repertoire, error) {
			return []models.Repertoire{{ID: "existing-1", Name: "Najdorf", Color: models.ColorWhite}}, nil
		},
		CreateRepertoireFunc: func(_ context.Context, userID, name string, color models.Color) (*models.Repertoire, error) {
			createdCount++
			return &models.Repertoire{ID: fmt.Sprintf("rep-%d", createdCount), Name: name, Color: color}, nil
		},
		SaveTreeFunc: func(_ context.Context, userID, repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error) {
			return &models.Repertoire{ID: repertoireID, TreeData: treeData}, nil
		},
	}
	svc := NewStudyImportService(mockLichess, mockRepSvc, &mocks.MockUserRepo{})

	_, err := svc.ImportStudyChaptersWithCategory(context.Background(), "user-1", "testid01", "", []int{0, 1}, false, "", false, false, RenameStrategyAbort)

	var conflictErr *StudyImportConflictError
	require.ErrorAs(t, err, &conflictErr)
	require.Len(t, conflictErr.Conflicts, 1)
	assert.Equal(t, "Najdorf", conflictErr.Conflicts[0].TargetName)
	assert.Equal(t, "existing-1", conflictErr.Conflicts[0].ExistingID)
	assert.Equal(t, "white", conflictErr.Conflicts[0].ExistingColor)
	assert.Equal(t, 0, createdCount, "should not create any repertoires when conflict aborts the import")
}

func TestStudyImportService_ImportStudyChaptersWithCategory_AutoSuffixRenames(t *testing.T) {
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) { return studyPGNForConflict, nil },
	}
	var createdNames []string
	mockRepSvc := &smocks.MockRepertoireService{
		ListRepertoiresFunc: func(_ context.Context, userID string, color *models.Color) ([]models.Repertoire, error) {
			return []models.Repertoire{
				{ID: "existing-1", Name: "Najdorf", Color: models.ColorWhite},
				{ID: "existing-2", Name: "Najdorf (2)", Color: models.ColorWhite},
			}, nil
		},
		CreateRepertoireFunc: func(_ context.Context, userID, name string, color models.Color) (*models.Repertoire, error) {
			createdNames = append(createdNames, name)
			return &models.Repertoire{ID: fmt.Sprintf("rep-%d", len(createdNames)), Name: name, Color: color}, nil
		},
		SaveTreeFunc: func(_ context.Context, userID, repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error) {
			return &models.Repertoire{ID: repertoireID, TreeData: treeData}, nil
		},
	}
	svc := NewStudyImportService(mockLichess, mockRepSvc, &mocks.MockUserRepo{})

	result, err := svc.ImportStudyChaptersWithCategory(context.Background(), "user-1", "testid01", "", []int{0, 1}, false, "", false, false, RenameStrategyAutoSuffix)

	require.NoError(t, err)
	require.NotNil(t, result)
	require.Len(t, createdNames, 2)
	// Najdorf collides with two existing entries → "Najdorf (3)"; Sveshnikov is free.
	assert.Equal(t, "Najdorf (3)", createdNames[0])
	assert.Equal(t, "Sveshnikov", createdNames[1])
}

func TestStudyImportService_ImportStudyChaptersWithCategory_AutoSuffixHandlesDuplicateChapters(t *testing.T) {
	// Two chapters with the same name, no pre-existing repertoires.
	pgn := `[Event "Study: King's Indian"]
[Orientation "White"]

1. d4 Nf6 *

[Event "Study: King's Indian"]
[Orientation "White"]

1. d4 Nf6 2. c4 *
`
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) { return pgn, nil },
	}
	var createdNames []string
	mockRepSvc := &smocks.MockRepertoireService{
		ListRepertoiresFunc: func(_ context.Context, userID string, color *models.Color) ([]models.Repertoire, error) {
			return nil, nil
		},
		CreateRepertoireFunc: func(_ context.Context, userID, name string, color models.Color) (*models.Repertoire, error) {
			createdNames = append(createdNames, name)
			return &models.Repertoire{ID: fmt.Sprintf("rep-%d", len(createdNames)), Name: name, Color: color}, nil
		},
		SaveTreeFunc: func(_ context.Context, userID, repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error) {
			return &models.Repertoire{ID: repertoireID, TreeData: treeData}, nil
		},
	}
	svc := NewStudyImportService(mockLichess, mockRepSvc, &mocks.MockUserRepo{})

	_, err := svc.ImportStudyChaptersWithCategory(context.Background(), "user-1", "testid01", "", []int{0, 1}, false, "", false, false, RenameStrategyAutoSuffix)

	require.NoError(t, err)
	require.Len(t, createdNames, 2)
	assert.Equal(t, "King's Indian", createdNames[0])
	assert.Equal(t, "King's Indian (2)", createdNames[1])
}

func TestStudyImportService_ImportStudyChaptersMerged_AbortsOnConflict(t *testing.T) {
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) { return studyPGNForConflict, nil },
	}
	mockRepSvc := &smocks.MockRepertoireService{
		ListRepertoiresFunc: func(_ context.Context, userID string, color *models.Color) ([]models.Repertoire, error) {
			return []models.Repertoire{{ID: "existing-merged", Name: "Sicilian Study", Color: models.ColorWhite}}, nil
		},
		CreateRepertoireFunc: func(_ context.Context, userID, name string, color models.Color) (*models.Repertoire, error) {
			t.Fatalf("create should not be called when conflict aborts the merged import")
			return nil, nil
		},
	}
	svc := NewStudyImportService(mockLichess, mockRepSvc, &mocks.MockUserRepo{})

	_, err := svc.ImportStudyChaptersMerged(context.Background(), "user-1", "testid01", "", []int{0, 1}, "", false, false, RenameStrategyAbort)

	var conflictErr *StudyImportConflictError
	require.ErrorAs(t, err, &conflictErr)
	require.Len(t, conflictErr.Conflicts, 1)
	assert.Equal(t, "Sicilian Study", conflictErr.Conflicts[0].TargetName)
	assert.Equal(t, "existing-merged", conflictErr.Conflicts[0].ExistingID)
}

func TestStudyImportService_ImportStudyChaptersMerged_AutoSuffixRenames(t *testing.T) {
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) { return studyPGNForConflict, nil },
	}
	var createdName string
	mockRepSvc := &smocks.MockRepertoireService{
		ListRepertoiresFunc: func(_ context.Context, userID string, color *models.Color) ([]models.Repertoire, error) {
			return []models.Repertoire{{ID: "existing-merged", Name: "Sicilian Study", Color: models.ColorWhite}}, nil
		},
		CreateRepertoireFunc: func(_ context.Context, userID, name string, color models.Color) (*models.Repertoire, error) {
			createdName = name
			return &models.Repertoire{ID: "rep-merged", Name: name, Color: color}, nil
		},
		SaveTreeFunc: func(_ context.Context, userID, repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error) {
			return &models.Repertoire{ID: repertoireID, TreeData: treeData}, nil
		},
	}
	svc := NewStudyImportService(mockLichess, mockRepSvc, &mocks.MockUserRepo{})

	result, err := svc.ImportStudyChaptersMerged(context.Background(), "user-1", "testid01", "", []int{0, 1}, "", false, false, RenameStrategyAutoSuffix)

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, "Sicilian Study (2)", createdName)
}

func TestStudyImportService_ImportStudyChapters_CreateError(t *testing.T) {
	pgnData := `[Event "Study: Test"]
[Orientation "White"]

1. e4 e5 *
`
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return pgnData, nil
		},
	}
	mockRepSvc := &smocks.MockRepertoireService{
		CreateRepertoireFunc: func(_ context.Context, userID, name string, color models.Color) (*models.Repertoire, error) {
			return nil, ErrLimitReached
		},
	}

	svc := NewStudyImportService(mockLichess, mockRepSvc, &mocks.MockUserRepo{})
	_, err := svc.ImportStudyChapters(context.Background(), "user-1", "testid01", "", []int{0})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to create repertoire")
}
