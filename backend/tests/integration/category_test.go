//go:build integration

package integration

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/testhelpers"
)

// ========================================================================
// CRUD operations
// ========================================================================

func TestCategory_Create_Success(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "catuser1", "password123")

	body, _ := json.Marshal(models.CreateCategoryRequest{Name: "Italian", Color: "white"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", body, token))
	require.Equal(t, http.StatusCreated, rec.Code)

	var cat models.Category
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &cat))
	assert.Equal(t, "Italian", cat.Name)
	assert.Equal(t, models.Color("white"), cat.Color)
	assert.NotEmpty(t, cat.ID)
	assert.False(t, cat.CreatedAt.IsZero())
}

func TestCategory_Create_BothColors(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "catuser2", "password123")

	// Create a white category.
	body1, _ := json.Marshal(models.CreateCategoryRequest{Name: "e4 openings", Color: "white"})
	rec1 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", body1, token))
	require.Equal(t, http.StatusCreated, rec1.Code)

	// Create a black category with the same name (allowed — different color).
	body2, _ := json.Marshal(models.CreateCategoryRequest{Name: "e4 openings", Color: "black"})
	rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", body2, token))
	require.Equal(t, http.StatusCreated, rec2.Code)

	var cat1, cat2 models.Category
	require.NoError(t, json.Unmarshal(rec1.Body.Bytes(), &cat1))
	require.NoError(t, json.Unmarshal(rec2.Body.Bytes(), &cat2))

	assert.Equal(t, models.Color("white"), cat1.Color)
	assert.Equal(t, models.Color("black"), cat2.Color)
	assert.NotEqual(t, cat1.ID, cat2.ID)
}

func TestCategory_Get_WithRepertoires(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "catuser3", "password123")

	// Create a category.
	catBody, _ := json.Marshal(models.CreateCategoryRequest{Name: "Sicilian", Color: "white"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", catBody, token))
	require.Equal(t, http.StatusCreated, rec.Code)
	var cat models.Category
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &cat))

	// Create a repertoire.
	repBody, _ := json.Marshal(map[string]string{"name": "Sicilian Main", "color": "white"})
	rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/repertoires", repBody, token))
	require.Equal(t, http.StatusCreated, rec2.Code)
	var rep models.Repertoire
	require.NoError(t, json.Unmarshal(rec2.Body.Bytes(), &rep))

	// Assign repertoire to category.
	assignBody, _ := json.Marshal(models.AssignCategoryRequest{CategoryID: &cat.ID})
	rec3 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPatch, "/api/repertoires/"+rep.ID+"/category", assignBody, token))
	require.Equal(t, http.StatusOK, rec3.Code)

	// Get the category — should include the repertoire.
	rec4 := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/categories/"+cat.ID, nil, token))
	require.Equal(t, http.StatusOK, rec4.Code)

	var catWithReps models.CategoryWithRepertoires
	require.NoError(t, json.Unmarshal(rec4.Body.Bytes(), &catWithReps))
	assert.Equal(t, cat.ID, catWithReps.ID)
	require.Len(t, catWithReps.Repertoires, 1)
	assert.Equal(t, rep.ID, catWithReps.Repertoires[0].ID)
}

func TestCategory_List_ByColor(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "catuser4", "password123")

	// Create 2 white and 1 black category.
	for _, c := range []struct{ name, color string }{
		{"Cat W1", "white"}, {"Cat W2", "white"}, {"Cat B1", "black"},
	} {
		b, _ := json.Marshal(models.CreateCategoryRequest{Name: c.name, Color: models.Color(c.color)})
		rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", b, token))
		require.Equal(t, http.StatusCreated, rec.Code)
	}

	// List white only.
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/categories?color=white", nil, token))
	require.Equal(t, http.StatusOK, rec.Code)
	var whiteCats []models.Category
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &whiteCats))
	assert.Len(t, whiteCats, 2)

	// List black only.
	rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/categories?color=black", nil, token))
	require.Equal(t, http.StatusOK, rec2.Code)
	var blackCats []models.Category
	require.NoError(t, json.Unmarshal(rec2.Body.Bytes(), &blackCats))
	assert.Len(t, blackCats, 1)
}

func TestCategory_List_All(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "catuser5", "password123")

	for _, c := range []struct{ name, color string }{
		{"Cat 1", "white"}, {"Cat 2", "black"}, {"Cat 3", "white"},
	} {
		b, _ := json.Marshal(models.CreateCategoryRequest{Name: c.name, Color: models.Color(c.color)})
		rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", b, token))
		require.Equal(t, http.StatusCreated, rec.Code)
	}

	// List all (no color filter).
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/categories", nil, token))
	require.Equal(t, http.StatusOK, rec.Code)
	var allCats []models.Category
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &allCats))
	assert.Len(t, allCats, 3)
}

func TestCategory_List_Empty(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "catuser6", "password123")

	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/categories", nil, token))
	require.Equal(t, http.StatusOK, rec.Code)

	// Should be an empty JSON array, not null.
	assert.Equal(t, "[]", strings.TrimSpace(rec.Body.String()))
}

func TestCategory_Rename_Success(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "catuser7", "password123")

	// Create.
	body, _ := json.Marshal(models.CreateCategoryRequest{Name: "Old Name", Color: "white"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", body, token))
	require.Equal(t, http.StatusCreated, rec.Code)
	var cat models.Category
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &cat))

	// Rename.
	renameBody, _ := json.Marshal(models.UpdateCategoryRequest{Name: "New Name"})
	rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPatch, "/api/categories/"+cat.ID, renameBody, token))
	require.Equal(t, http.StatusOK, rec2.Code)

	var updated models.Category
	require.NoError(t, json.Unmarshal(rec2.Body.Bytes(), &updated))
	assert.Equal(t, "New Name", updated.Name)
	assert.Equal(t, cat.ID, updated.ID)
}

func TestCategory_Delete_Success(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "catuser8", "password123")

	body, _ := json.Marshal(models.CreateCategoryRequest{Name: "To Delete", Color: "black"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", body, token))
	require.Equal(t, http.StatusCreated, rec.Code)
	var cat models.Category
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &cat))

	// Delete.
	rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodDelete, "/api/categories/"+cat.ID, nil, token))
	require.Equal(t, http.StatusNoContent, rec2.Code)

	// Get should now 404.
	rec3 := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/categories/"+cat.ID, nil, token))
	assert.Equal(t, http.StatusNotFound, rec3.Code)
}

// ========================================================================
// Validation
// ========================================================================

func TestCategory_Create_EmptyName(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "catval1", "password123")

	body, _ := json.Marshal(models.CreateCategoryRequest{Name: "", Color: "white"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", body, token))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestCategory_Create_NameTooLong(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "catval2", "password123")

	longName := strings.Repeat("a", 101)
	body, _ := json.Marshal(models.CreateCategoryRequest{Name: longName, Color: "white"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", body, token))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestCategory_Create_InvalidColor(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "catval3", "password123")

	body, _ := json.Marshal(models.CreateCategoryRequest{Name: "Test", Color: "green"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", body, token))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestCategory_Create_DuplicateNameColor(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "catval4", "password123")

	body, _ := json.Marshal(models.CreateCategoryRequest{Name: "Duplicate", Color: "white"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", body, token))
	require.Equal(t, http.StatusCreated, rec.Code)

	// Same name + same color should fail.
	rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", body, token))
	assert.NotEqual(t, http.StatusCreated, rec2.Code, "duplicate (name, color) should be rejected")
}

func TestCategory_Rename_EmptyName(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "catval5", "password123")

	body, _ := json.Marshal(models.CreateCategoryRequest{Name: "Original", Color: "white"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", body, token))
	require.Equal(t, http.StatusCreated, rec.Code)
	var cat models.Category
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &cat))

	renameBody, _ := json.Marshal(models.UpdateCategoryRequest{Name: ""})
	rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPatch, "/api/categories/"+cat.ID, renameBody, token))
	assert.Equal(t, http.StatusBadRequest, rec2.Code)
}

func TestCategory_List_InvalidColor(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "catval6", "password123")

	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/categories?color=red", nil, token))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

// ========================================================================
// Limits
// ========================================================================

func TestCategory_Create_LimitReached(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "catlimit1", "password123")

	// Create 50 categories (the maximum).
	for i := 0; i < 50; i++ {
		color := "white"
		if i%2 == 0 {
			color = "black"
		}
		body, _ := json.Marshal(models.CreateCategoryRequest{
			Name:  fmt.Sprintf("Cat %d", i),
			Color: models.Color(color),
		})
		rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", body, token))
		require.Equal(t, http.StatusCreated, rec.Code, "creating category %d should succeed", i)
	}

	// The 51st should fail with 409 (Conflict).
	body, _ := json.Marshal(models.CreateCategoryRequest{Name: "One Too Many", Color: "white"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", body, token))
	assert.Equal(t, http.StatusConflict, rec.Code)
}

func TestCategory_Limit_PerUser(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	tokenA := ts.AuthToken(t, "catlimA", "password123")
	tokenB := ts.AuthToken(t, "catlimB", "password123")

	// User A creates 50 categories.
	for i := 0; i < 50; i++ {
		body, _ := json.Marshal(models.CreateCategoryRequest{
			Name:  fmt.Sprintf("A Cat %d", i),
			Color: "white",
		})
		rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", body, tokenA))
		require.Equal(t, http.StatusCreated, rec.Code)
	}

	// User B should still be able to create categories.
	body, _ := json.Marshal(models.CreateCategoryRequest{Name: "B Cat", Color: "white"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", body, tokenB))
	assert.Equal(t, http.StatusCreated, rec.Code, "user B should not be blocked by user A's limit")
}

// ========================================================================
// Ownership / isolation
// ========================================================================

func TestCategory_Isolation_GetByOtherUser(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	tokenA := ts.AuthToken(t, "catiso1a", "password123")
	tokenB := ts.AuthToken(t, "catiso1b", "password123")

	// User A creates a category.
	body, _ := json.Marshal(models.CreateCategoryRequest{Name: "Private Cat", Color: "white"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", body, tokenA))
	require.Equal(t, http.StatusCreated, rec.Code)
	var cat models.Category
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &cat))

	// User B tries to get it — should be 404.
	rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/categories/"+cat.ID, nil, tokenB))
	assert.Equal(t, http.StatusNotFound, rec2.Code)
}

func TestCategory_Isolation_DeleteByOtherUser(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	tokenA := ts.AuthToken(t, "catiso2a", "password123")
	tokenB := ts.AuthToken(t, "catiso2b", "password123")

	body, _ := json.Marshal(models.CreateCategoryRequest{Name: "Secret Cat", Color: "black"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", body, tokenA))
	require.Equal(t, http.StatusCreated, rec.Code)
	var cat models.Category
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &cat))

	// User B tries to delete it — should be 404.
	rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodDelete, "/api/categories/"+cat.ID, nil, tokenB))
	assert.Equal(t, http.StatusNotFound, rec2.Code)

	// Verify category still exists for user A.
	rec3 := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/categories/"+cat.ID, nil, tokenA))
	assert.Equal(t, http.StatusOK, rec3.Code)
}

func TestCategory_Isolation_RenameByOtherUser(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	tokenA := ts.AuthToken(t, "catiso3a", "password123")
	tokenB := ts.AuthToken(t, "catiso3b", "password123")

	body, _ := json.Marshal(models.CreateCategoryRequest{Name: "Original", Color: "white"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", body, tokenA))
	require.Equal(t, http.StatusCreated, rec.Code)
	var cat models.Category
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &cat))

	// User B tries to rename it — should be 404.
	renameBody, _ := json.Marshal(models.UpdateCategoryRequest{Name: "Hacked"})
	rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPatch, "/api/categories/"+cat.ID, renameBody, tokenB))
	assert.Equal(t, http.StatusNotFound, rec2.Code)
}

func TestCategory_Isolation_ListOnlyOwn(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	tokenA := ts.AuthToken(t, "catiso4a", "password123")
	tokenB := ts.AuthToken(t, "catiso4b", "password123")

	// User A creates 2 categories.
	for _, name := range []string{"A-Cat-1", "A-Cat-2"} {
		b, _ := json.Marshal(models.CreateCategoryRequest{Name: name, Color: "white"})
		rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", b, tokenA))
		require.Equal(t, http.StatusCreated, rec.Code)
	}

	// User B creates 1 category.
	b, _ := json.Marshal(models.CreateCategoryRequest{Name: "B-Cat-1", Color: "white"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", b, tokenB))
	require.Equal(t, http.StatusCreated, rec.Code)

	// User A lists — should see exactly 2.
	rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/categories", nil, tokenA))
	require.Equal(t, http.StatusOK, rec2.Code)
	var aCats []models.Category
	require.NoError(t, json.Unmarshal(rec2.Body.Bytes(), &aCats))
	assert.Len(t, aCats, 2)

	// User B lists — should see exactly 1.
	rec3 := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/categories", nil, tokenB))
	require.Equal(t, http.StatusOK, rec3.Code)
	var bCats []models.Category
	require.NoError(t, json.Unmarshal(rec3.Body.Bytes(), &bCats))
	assert.Len(t, bCats, 1)
}

// ========================================================================
// Cascade & assign
// ========================================================================

func TestCategory_Delete_CascadesRepertoires(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "catcasc1", "password123")

	// Create a category.
	catBody, _ := json.Marshal(models.CreateCategoryRequest{Name: "Doomed", Color: "white"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", catBody, token))
	require.Equal(t, http.StatusCreated, rec.Code)
	var cat models.Category
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &cat))

	// Create 2 repertoires and assign them to the category.
	var repIDs []string
	for _, name := range []string{"Rep 1", "Rep 2"} {
		repBody, _ := json.Marshal(map[string]string{"name": name, "color": "white"})
		rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/repertoires", repBody, token))
		require.Equal(t, http.StatusCreated, rec2.Code)
		var rep models.Repertoire
		require.NoError(t, json.Unmarshal(rec2.Body.Bytes(), &rep))
		repIDs = append(repIDs, rep.ID)

		assignBody, _ := json.Marshal(models.AssignCategoryRequest{CategoryID: &cat.ID})
		rec3 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPatch, "/api/repertoires/"+rep.ID+"/category", assignBody, token))
		require.Equal(t, http.StatusOK, rec3.Code)
	}

	// Delete the category.
	rec4 := ts.DoRequest(testhelpers.AuthRequest(http.MethodDelete, "/api/categories/"+cat.ID, nil, token))
	require.Equal(t, http.StatusNoContent, rec4.Code)

	// Repertoires should be gone (ON DELETE CASCADE).
	for _, id := range repIDs {
		rec5 := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/repertoires/"+id, nil, token))
		assert.Equal(t, http.StatusNotFound, rec5.Code, "repertoire %s should be deleted by cascade", id)
	}
}

func TestCategory_AssignRepertoire_Success(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "catassign1", "password123")

	// Create category and repertoire.
	catBody, _ := json.Marshal(models.CreateCategoryRequest{Name: "Assign Test", Color: "white"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", catBody, token))
	require.Equal(t, http.StatusCreated, rec.Code)
	var cat models.Category
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &cat))

	repBody, _ := json.Marshal(map[string]string{"name": "My Rep", "color": "white"})
	rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/repertoires", repBody, token))
	require.Equal(t, http.StatusCreated, rec2.Code)
	var rep models.Repertoire
	require.NoError(t, json.Unmarshal(rec2.Body.Bytes(), &rep))

	// Assign.
	assignBody, _ := json.Marshal(models.AssignCategoryRequest{CategoryID: &cat.ID})
	rec3 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPatch, "/api/repertoires/"+rep.ID+"/category", assignBody, token))
	require.Equal(t, http.StatusOK, rec3.Code)

	// Verify by getting the category with repertoires.
	rec4 := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/categories/"+cat.ID, nil, token))
	require.Equal(t, http.StatusOK, rec4.Code)
	var catWithReps models.CategoryWithRepertoires
	require.NoError(t, json.Unmarshal(rec4.Body.Bytes(), &catWithReps))
	require.Len(t, catWithReps.Repertoires, 1)
	assert.Equal(t, rep.ID, catWithReps.Repertoires[0].ID)
}

func TestCategory_AssignRepertoire_Unassign(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "catassign2", "password123")

	// Create category and repertoire, assign.
	catBody, _ := json.Marshal(models.CreateCategoryRequest{Name: "Temp", Color: "white"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", catBody, token))
	require.Equal(t, http.StatusCreated, rec.Code)
	var cat models.Category
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &cat))

	repBody, _ := json.Marshal(map[string]string{"name": "Rep", "color": "white"})
	rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/repertoires", repBody, token))
	require.Equal(t, http.StatusCreated, rec2.Code)
	var rep models.Repertoire
	require.NoError(t, json.Unmarshal(rec2.Body.Bytes(), &rep))

	assignBody, _ := json.Marshal(models.AssignCategoryRequest{CategoryID: &cat.ID})
	ts.DoRequest(testhelpers.AuthRequest(http.MethodPatch, "/api/repertoires/"+rep.ID+"/category", assignBody, token))

	// Unassign by sending null categoryId.
	unassignBody := []byte(`{"categoryId": null}`)
	rec3 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPatch, "/api/repertoires/"+rep.ID+"/category", unassignBody, token))
	require.Equal(t, http.StatusOK, rec3.Code)

	// Category should now have 0 repertoires.
	rec4 := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/categories/"+cat.ID, nil, token))
	require.Equal(t, http.StatusOK, rec4.Code)
	var catWithReps models.CategoryWithRepertoires
	require.NoError(t, json.Unmarshal(rec4.Body.Bytes(), &catWithReps))
	assert.Empty(t, catWithReps.Repertoires)

	// The repertoire should still exist.
	rec5 := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/repertoires/"+rep.ID, nil, token))
	assert.Equal(t, http.StatusOK, rec5.Code)
}

func TestCategory_AssignRepertoire_InvalidCategory(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "catassign3", "password123")

	repBody, _ := json.Marshal(map[string]string{"name": "Rep", "color": "white"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/repertoires", repBody, token))
	require.Equal(t, http.StatusCreated, rec.Code)
	var rep models.Repertoire
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &rep))

	// Assign to a non-existent category.
	fakeID := "00000000-0000-0000-0000-000000000000"
	assignBody, _ := json.Marshal(models.AssignCategoryRequest{CategoryID: &fakeID})
	rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPatch, "/api/repertoires/"+rep.ID+"/category", assignBody, token))
	assert.Equal(t, http.StatusNotFound, rec2.Code)
}

func TestCategory_Unauthenticated(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	endpoints := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/categories"},
		{http.MethodPost, "/api/categories"},
		{http.MethodGet, "/api/categories/00000000-0000-0000-0000-000000000000"},
		{http.MethodPatch, "/api/categories/00000000-0000-0000-0000-000000000000"},
		{http.MethodDelete, "/api/categories/00000000-0000-0000-0000-000000000000"},
	}

	for _, ep := range endpoints {
		t.Run(ep.method+" "+ep.path, func(t *testing.T) {
			rec := ts.DoRequest(testhelpers.AuthRequest(ep.method, ep.path, nil, ""))
			assert.Equal(t, http.StatusUnauthorized, rec.Code)
		})
	}
}
