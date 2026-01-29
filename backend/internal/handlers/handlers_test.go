package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
	"github.com/treechess/backend/internal/repository/mocks"
	"github.com/treechess/backend/internal/services"
)

// Helper function to create a RepertoireService with a mock repo
func newTestRepertoireService() *services.RepertoireService {
	mockRepo := &mocks.MockRepertoireRepo{}
	return services.NewRepertoireService(mockRepo)
}

func TestHealthHandler(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := HealthHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "ok", response["status"])
}

func TestListRepertoiresHandler_InvalidColor(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/repertoires?color=invalid", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	svc := newTestRepertoireService()
	handler := ListRepertoiresHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "invalid color")
}

func TestGetRepertoireHandler_InvalidID(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/repertoires/not-a-uuid", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("not-a-uuid")

	svc := newTestRepertoireService()
	handler := GetRepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "valid UUID")
}

func TestCreateRepertoireHandler_MissingName(t *testing.T) {
	e := echo.New()
	body := `{"color":"white"}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoires", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	svc := newTestRepertoireService()
	handler := CreateRepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "name is required")
}

func TestCreateRepertoireHandler_InvalidColor(t *testing.T) {
	e := echo.New()
	body := `{"name":"Test","color":"invalid"}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoires", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	svc := newTestRepertoireService()
	handler := CreateRepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "invalid color")
}

func TestCreateRepertoireHandler_InvalidJSON(t *testing.T) {
	e := echo.New()
	body := `{invalid json}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoires", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	svc := newTestRepertoireService()
	handler := CreateRepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestUpdateRepertoireHandler_InvalidID(t *testing.T) {
	e := echo.New()
	body := `{"name":"New Name"}`
	req := httptest.NewRequest(http.MethodPatch, "/api/repertoires/not-a-uuid", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("not-a-uuid")

	svc := newTestRepertoireService()
	handler := UpdateRepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "valid UUID")
}

func TestDeleteRepertoireHandler_InvalidID(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, "/api/repertoires/not-a-uuid", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("not-a-uuid")

	svc := newTestRepertoireService()
	handler := DeleteRepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAddNodeHandler_InvalidRepertoireID(t *testing.T) {
	e := echo.New()
	body := `{"parentId":"123e4567-e89b-12d3-a456-426614174000","move":"e4"}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoires/not-a-uuid/nodes", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("not-a-uuid")

	svc := newTestRepertoireService()
	handler := AddNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "valid UUID")
}

func TestAddNodeHandler_MissingParentID(t *testing.T) {
	e := echo.New()
	body := `{"move":"e4"}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoires/123e4567-e89b-12d3-a456-426614174000/nodes", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("123e4567-e89b-12d3-a456-426614174000")

	svc := newTestRepertoireService()
	handler := AddNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "parentId is required", response["error"])
}

func TestAddNodeHandler_InvalidParentID(t *testing.T) {
	e := echo.New()
	body := `{"parentId":"not-a-uuid","move":"e4"}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoires/123e4567-e89b-12d3-a456-426614174000/nodes", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("123e4567-e89b-12d3-a456-426614174000")

	svc := newTestRepertoireService()
	handler := AddNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "parentId must be a valid UUID")
}

func TestAddNodeHandler_MissingMove(t *testing.T) {
	e := echo.New()
	body := `{"parentId":"123e4567-e89b-12d3-a456-426614174000","moveNumber":1}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoires/123e4567-e89b-12d3-a456-426614174000/nodes", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("123e4567-e89b-12d3-a456-426614174000")

	svc := newTestRepertoireService()
	handler := AddNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "move is required", response["error"])
}

func TestAddNodeHandler_InvalidJSON(t *testing.T) {
	e := echo.New()
	body := `{invalid json}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoires/123e4567-e89b-12d3-a456-426614174000/nodes", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("123e4567-e89b-12d3-a456-426614174000")

	svc := newTestRepertoireService()
	handler := AddNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestDeleteNodeHandler_InvalidRepertoireID(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, "/api/repertoires/not-a-uuid/nodes/123e4567-e89b-12d3-a456-426614174000", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id", "nodeId")
	c.SetParamValues("not-a-uuid", "123e4567-e89b-12d3-a456-426614174000")

	svc := newTestRepertoireService()
	handler := DeleteNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "repertoire id must be a valid UUID")
}

func TestDeleteNodeHandler_InvalidNodeID(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, "/api/repertoires/123e4567-e89b-12d3-a456-426614174000/nodes/not-a-uuid", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id", "nodeId")
	c.SetParamValues("123e4567-e89b-12d3-a456-426614174000", "not-a-uuid")

	svc := newTestRepertoireService()
	handler := DeleteNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "node id must be a valid UUID")
}

func TestRepertoireResponseFormat(t *testing.T) {
	expectedRoot := models.RepertoireNode{
		ID:          "test-id",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		MoveNumber:  0,
		ColorToMove: models.ChessColorWhite,
		ParentID:    nil,
		Children:    nil,
	}

	expected := models.Repertoire{
		ID:       "test-rep-id",
		Name:     "Test Repertoire",
		Color:    models.ColorWhite,
		TreeData: expectedRoot,
		Metadata: models.Metadata{TotalNodes: 1, TotalMoves: 0, DeepestDepth: 0},
	}

	data, err := json.Marshal(expected)
	require.NoError(t, err)

	var decoded models.Repertoire
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, expected.ID, decoded.ID)
	assert.Equal(t, expected.Name, decoded.Name)
	assert.Equal(t, expected.Color, decoded.Color)
	assert.Nil(t, decoded.TreeData.Move)
	assert.Equal(t, expected.Metadata.TotalNodes, decoded.Metadata.TotalNodes)
}

func TestHealthHandler_ResponseFormat(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := HealthHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "ok", response["status"])
	assert.Contains(t, rec.Header().Get("Content-Type"), "application/json")
}

// Tests using mocks instead of database

func TestListRepertoiresHandler_WithColor(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/repertoires?color=white", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	mockRepo := &mocks.MockRepertoireRepo{
		GetByColorFunc: func(color models.Color) ([]models.Repertoire, error) {
			return []models.Repertoire{
				{ID: "uuid-1", Name: "White Opening", Color: models.ColorWhite},
				{ID: "uuid-2", Name: "Sicilian Defense", Color: models.ColorWhite},
			}, nil
		},
	}
	svc := services.NewRepertoireService(mockRepo)
	handler := ListRepertoiresHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response []models.Repertoire
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Len(t, response, 2)
	assert.Equal(t, "White Opening", response[0].Name)
}

func TestListRepertoiresHandler_NoFilter(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/repertoires", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	mockRepo := &mocks.MockRepertoireRepo{
		GetAllFunc: func() ([]models.Repertoire, error) {
			return []models.Repertoire{
				{ID: "uuid-1", Name: "White Opening", Color: models.ColorWhite},
				{ID: "uuid-2", Name: "Black Defense", Color: models.ColorBlack},
			}, nil
		},
	}
	svc := services.NewRepertoireService(mockRepo)
	handler := ListRepertoiresHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response []models.Repertoire
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Len(t, response, 2)
}

func TestCreateRepertoireHandler_ValidRequest(t *testing.T) {
	e := echo.New()
	body := `{"name":"My Repertoire","color":"white"}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoires", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	mockRepo := &mocks.MockRepertoireRepo{
		CountFunc: func() (int, error) { return 0, nil },
		CreateFunc: func(name string, color models.Color) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:    "new-uuid",
				Name:  name,
				Color: color,
				TreeData: models.RepertoireNode{
					ID:  "root-uuid",
					FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
				},
				Metadata: models.Metadata{TotalNodes: 1},
			}, nil
		},
	}
	svc := services.NewRepertoireService(mockRepo)
	handler := CreateRepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusCreated, rec.Code)

	var response models.Repertoire
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "My Repertoire", response.Name)
	assert.Equal(t, models.ColorWhite, response.Color)
}

func TestGetRepertoireHandler_ValidID(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	req := httptest.NewRequest(http.MethodGet, "/api/repertoires/"+validUUID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)

	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:    id,
				Name:  "Test Repertoire",
				Color: models.ColorWhite,
				TreeData: models.RepertoireNode{
					ID:  "root-uuid",
					FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
				},
			}, nil
		},
	}
	svc := services.NewRepertoireService(mockRepo)
	handler := GetRepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response models.Repertoire
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, validUUID, response.ID)
	assert.Equal(t, "Test Repertoire", response.Name)
}

func TestGetRepertoireHandler_NotFound(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	req := httptest.NewRequest(http.MethodGet, "/api/repertoires/"+validUUID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)

	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(id string) (*models.Repertoire, error) {
			return nil, repository.ErrRepertoireNotFound
		},
	}
	svc := services.NewRepertoireService(mockRepo)
	handler := GetRepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestUpdateRepertoireHandler_ValidRequest(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	body := `{"name":"Updated Name"}`
	req := httptest.NewRequest(http.MethodPatch, "/api/repertoires/"+validUUID, strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)

	mockRepo := &mocks.MockRepertoireRepo{
		ExistsFunc: func(id string) (bool, error) { return true, nil },
		UpdateNameFunc: func(id string, name string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:    id,
				Name:  name,
				Color: models.ColorWhite,
			}, nil
		},
	}
	svc := services.NewRepertoireService(mockRepo)
	handler := UpdateRepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response models.Repertoire
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "Updated Name", response.Name)
}

func TestUpdateRepertoireHandler_NotFound(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	body := `{"name":"Updated Name"}`
	req := httptest.NewRequest(http.MethodPatch, "/api/repertoires/"+validUUID, strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)

	mockRepo := &mocks.MockRepertoireRepo{
		ExistsFunc: func(id string) (bool, error) { return false, nil },
	}
	svc := services.NewRepertoireService(mockRepo)
	handler := UpdateRepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestDeleteRepertoireHandler_ValidID(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	req := httptest.NewRequest(http.MethodDelete, "/api/repertoires/"+validUUID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)

	mockRepo := &mocks.MockRepertoireRepo{
		DeleteFunc: func(id string) error { return nil },
	}
	svc := services.NewRepertoireService(mockRepo)
	handler := DeleteRepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusNoContent, rec.Code)
}

func TestDeleteRepertoireHandler_NotFound(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	req := httptest.NewRequest(http.MethodDelete, "/api/repertoires/"+validUUID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)

	mockRepo := &mocks.MockRepertoireRepo{
		DeleteFunc: func(id string) error {
			return repository.ErrRepertoireNotFound
		},
	}
	svc := services.NewRepertoireService(mockRepo)
	handler := DeleteRepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestAddNodeHandler_ValidRequest(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	rootUUID := "223e4567-e89b-12d3-a456-426614174001" // Valid UUID format
	body := `{"parentId":"` + rootUUID + `","move":"e4","moveNumber":1}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoires/"+validUUID+"/nodes", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)

	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:    id,
				Name:  "Test",
				Color: models.ColorWhite,
				TreeData: models.RepertoireNode{
					ID:          rootUUID,
					FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
					ColorToMove: models.ChessColorWhite,
					Children:    []*models.RepertoireNode{},
				},
			}, nil
		},
		SaveFunc: func(id string, treeData models.RepertoireNode, metadata models.Metadata) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:       id,
				Name:     "Test",
				Color:    models.ColorWhite,
				TreeData: treeData,
				Metadata: metadata,
			}, nil
		},
	}
	svc := services.NewRepertoireService(mockRepo)
	handler := AddNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response models.Repertoire
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Len(t, response.TreeData.Children, 1)
	assert.Equal(t, "e4", *response.TreeData.Children[0].Move)
}

func TestAddNodeHandler_RepertoireNotFound(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	parentUUID := "223e4567-e89b-12d3-a456-426614174002" // Valid UUID format
	body := `{"parentId":"` + parentUUID + `","move":"e4","moveNumber":1}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoires/"+validUUID+"/nodes", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)

	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(id string) (*models.Repertoire, error) {
			return nil, repository.ErrRepertoireNotFound
		},
	}
	svc := services.NewRepertoireService(mockRepo)
	handler := AddNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestDeleteNodeHandler_ValidRequest(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	rootUUID := "223e4567-e89b-12d3-a456-426614174003"
	nodeUUID := "323e4567-e89b-12d3-a456-426614174004"
	move := "e4"

	req := httptest.NewRequest(http.MethodDelete, "/api/repertoires/"+validUUID+"/nodes/"+nodeUUID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id", "nodeId")
	c.SetParamValues(validUUID, nodeUUID)

	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:    id,
				Name:  "Test",
				Color: models.ColorWhite,
				TreeData: models.RepertoireNode{
					ID:  rootUUID,
					FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
					Children: []*models.RepertoireNode{
						{ID: nodeUUID, Move: &move, FEN: "after-e4"},
					},
				},
			}, nil
		},
		SaveFunc: func(id string, treeData models.RepertoireNode, metadata models.Metadata) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:       id,
				Name:     "Test",
				Color:    models.ColorWhite,
				TreeData: treeData,
				Metadata: metadata,
			}, nil
		},
	}
	svc := services.NewRepertoireService(mockRepo)
	handler := DeleteNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response models.Repertoire
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Len(t, response.TreeData.Children, 0)
}

func TestDeleteNodeHandler_CannotDeleteRoot(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	rootUUID := "223e4567-e89b-12d3-a456-426614174005"

	req := httptest.NewRequest(http.MethodDelete, "/api/repertoires/"+validUUID+"/nodes/"+rootUUID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id", "nodeId")
	c.SetParamValues(validUUID, rootUUID)

	mockRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID:    id,
				Name:  "Test",
				Color: models.ColorWhite,
				TreeData: models.RepertoireNode{
					ID:  rootUUID,
					FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
				},
			}, nil
		},
	}
	svc := services.NewRepertoireService(mockRepo)
	handler := DeleteNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "cannot delete root")
}
