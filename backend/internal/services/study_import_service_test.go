package services

import (
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
	svc := NewStudyImportService(mockLichess, &smocks.MockRepertoireService{}, nil, &mocks.MockUserRepo{})

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
	svc := NewStudyImportService(mockLichess, &smocks.MockRepertoireService{}, nil, &mocks.MockUserRepo{})

	_, err := svc.PreviewStudy("testid01", "")

	assert.ErrorIs(t, err, ErrLichessStudyNotFound)
}

func TestStudyImportService_PreviewStudy_EmptyPGN(t *testing.T) {
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return "", nil
		},
	}
	svc := NewStudyImportService(mockLichess, &smocks.MockRepertoireService{}, nil, &mocks.MockUserRepo{})

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
		CreateRepertoireFunc: func(userID, name string, color models.Color) (*models.Repertoire, error) {
			createdCount++
			return &models.Repertoire{
				ID:    fmt.Sprintf("rep-%d", createdCount),
				Name:  name,
				Color: color,
			}, nil
		},
		SaveTreeFunc: func(userID string, repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:       repertoireID,
				TreeData: treeData,
			}, nil
		},
	}

	svc := NewStudyImportService(mockLichess, mockRepSvc, nil, &mocks.MockUserRepo{})
	reps, err := svc.ImportStudyChapters("user-1", "testid01", "", []int{0, 2})

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
	svc := NewStudyImportService(mockLichess, &smocks.MockRepertoireService{}, nil, &mocks.MockUserRepo{})

	_, err := svc.ImportStudyChapters("user-1", "testid01", "", []int{0})

	assert.ErrorIs(t, err, ErrLichessStudyForbidden)
}

func TestStudyImportService_ImportStudyChapters_EmptyChapters(t *testing.T) {
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return "", nil
		},
	}
	svc := NewStudyImportService(mockLichess, &smocks.MockRepertoireService{}, nil, &mocks.MockUserRepo{})

	_, err := svc.ImportStudyChapters("user-1", "testid01", "", []int{0})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no chapters")
}

// --- GetLichessTokenForUser tests ---

func TestStudyImportService_GetLichessTokenForUser_Found(t *testing.T) {
	token := "lip_test_token_123"
	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) {
			return &models.User{
				ID:                 id,
				LichessAccessToken: &token,
			}, nil
		},
	}
	svc := NewStudyImportService(&smocks.MockLichessService{}, &smocks.MockRepertoireService{}, nil, mockUserRepo)

	result := svc.GetLichessTokenForUser("user-1")

	assert.Equal(t, "lip_test_token_123", result)
}

func TestStudyImportService_GetLichessTokenForUser_NoToken(t *testing.T) {
	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) {
			return &models.User{
				ID:                 id,
				LichessAccessToken: nil,
			}, nil
		},
	}
	svc := NewStudyImportService(&smocks.MockLichessService{}, &smocks.MockRepertoireService{}, nil, mockUserRepo)

	result := svc.GetLichessTokenForUser("user-1")

	assert.Empty(t, result)
}

func TestStudyImportService_GetLichessTokenForUser_UserNotFound(t *testing.T) {
	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) {
			return nil, fmt.Errorf("not found")
		},
	}
	svc := NewStudyImportService(&smocks.MockLichessService{}, &smocks.MockRepertoireService{}, nil, mockUserRepo)

	result := svc.GetLichessTokenForUser("nonexistent")

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

func TestStudyImportService_PreviewStudy_MarksCustomStartingPositionUnimportable(t *testing.T) {
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return studyPGNWithCustomStartingPositions, nil
		},
	}
	svc := NewStudyImportService(mockLichess, &smocks.MockRepertoireService{}, nil, &mocks.MockUserRepo{})

	info, err := svc.PreviewStudy("testid01", "")

	require.NoError(t, err)
	require.NotNil(t, info)
	require.Len(t, info.Chapters, 3)
	assert.True(t, info.Chapters[0].Importable)
	assert.Empty(t, info.Chapters[0].SkipReason)
	assert.False(t, info.Chapters[1].Importable)
	assert.Equal(t, models.SkipReasonCustomStartingPosition, info.Chapters[1].SkipReason)
	assert.False(t, info.Chapters[2].Importable)
	assert.Equal(t, models.SkipReasonCustomStartingPosition, info.Chapters[2].SkipReason)
}

func TestStudyImportService_ImportStudyChaptersWithCategory_ReturnsSkipped(t *testing.T) {
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return studyPGNWithCustomStartingPositions, nil
		},
	}
	createdCount := 0
	mockRepSvc := &smocks.MockRepertoireService{
		CreateRepertoireFunc: func(userID, name string, color models.Color) (*models.Repertoire, error) {
			createdCount++
			return &models.Repertoire{ID: fmt.Sprintf("rep-%d", createdCount), Name: name, Color: color}, nil
		},
		SaveTreeFunc: func(userID, repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error) {
			return &models.Repertoire{ID: repertoireID, TreeData: treeData}, nil
		},
	}
	svc := NewStudyImportService(mockLichess, mockRepSvc, nil, &mocks.MockUserRepo{})

	result, err := svc.ImportStudyChaptersWithCategory("user-1", "testid01", "", []int{0, 1, 2}, false, "", false, true)

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Len(t, result.Repertoires, 1)
	require.Len(t, result.Skipped, 2)
	assert.Equal(t, 1, result.Skipped[0].Index)
	assert.Equal(t, models.SkipReasonCustomStartingPosition, result.Skipped[0].Reason)
	assert.Equal(t, 2, result.Skipped[1].Index)
	assert.Equal(t, models.SkipReasonCustomStartingPosition, result.Skipped[1].Reason)
}

func TestStudyImportService_ImportStudyChaptersMerged_ReturnsSkipped(t *testing.T) {
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return studyPGNWithCustomStartingPositions, nil
		},
	}
	mockRepSvc := &smocks.MockRepertoireService{
		CreateRepertoireFunc: func(userID, name string, color models.Color) (*models.Repertoire, error) {
			return &models.Repertoire{ID: "rep-1", Name: name, Color: color}, nil
		},
		SaveTreeFunc: func(userID, repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error) {
			return &models.Repertoire{ID: repertoireID, TreeData: treeData}, nil
		},
	}
	svc := NewStudyImportService(mockLichess, mockRepSvc, nil, &mocks.MockUserRepo{})

	result, err := svc.ImportStudyChaptersMerged("user-1", "testid01", "", []int{0, 1, 2}, "Merged", false, true)

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
	svc := NewStudyImportService(mockLichess, &smocks.MockRepertoireService{}, nil, &mocks.MockUserRepo{})

	_, err := svc.ImportStudyChaptersMerged("user-1", "testid01", "", []int{0, 1}, "Merged", false, true)

	assert.ErrorIs(t, err, ErrAllChaptersSkipped)
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
		CreateRepertoireFunc: func(userID, name string, color models.Color) (*models.Repertoire, error) {
			return nil, ErrLimitReached
		},
	}

	svc := NewStudyImportService(mockLichess, mockRepSvc, nil, &mocks.MockUserRepo{})
	_, err := svc.ImportStudyChapters("user-1", "testid01", "", []int{0})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to create repertoire")
}
