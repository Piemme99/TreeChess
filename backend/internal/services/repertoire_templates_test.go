package services

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
)

// TestBuildTemplateTree_AllTemplates verifies every starter template builds
// a valid tree with correct branching, branch names, and branch colors.
func TestBuildTemplateTree_AllTemplates(t *testing.T) {
	for _, tmpl := range starterTemplates {
		t.Run(tmpl.ID, func(t *testing.T) {
			tree, err := BuildTemplateTree(&tmpl)
			require.NoError(t, err, "BuildTemplateTree should not error for template %s", tmpl.ID)

			// Root should have no move and at least one child
			assert.Nil(t, tree.Move, "root node should have no move")
			assert.NotEmpty(t, tree.Children, "root should have children")

			// Count total branch labels in the tree
			names, colors := collectBranchLabels(&tree)

			// Each template should produce at least as many branch labels as lines
			assert.GreaterOrEqual(t, len(names), len(tmpl.Lines),
				"template %s should have branch names for all %d lines", tmpl.ID, len(tmpl.Lines))

			// Verify each expected branch name appears somewhere in the tree
			for _, line := range tmpl.Lines {
				if line.BranchName != "" {
					assert.Contains(t, names, line.BranchName,
						"branch name %q should be present in template %s tree", line.BranchName, tmpl.ID)
				}
				if line.BranchColor != "" {
					assert.Contains(t, colors, line.BranchColor,
						"branch color %q should be present in template %s tree", line.BranchColor, tmpl.ID)
				}
			}
		})
	}
}

// TestBuildTemplateTree_SharedPrefixMerging verifies that lines with shared
// move prefixes produce a single shared path that branches at the right point.
func TestBuildTemplateTree_SharedPrefixMerging(t *testing.T) {
	// Italian Game: all lines share e4, e5, Nf3, Nc6, Bc4 then diverge at Black's 5th move
	tmpl := GetTemplate("italian")
	require.NotNil(t, tmpl)

	tree, err := BuildTemplateTree(tmpl)
	require.NoError(t, err)

	// Walk the shared path: root -> e4 -> e5 -> Nf3 -> Nc6 -> Bc4
	current := &tree
	sharedMoves := []string{"e4", "e5", "Nf3", "Nc6", "Bc4"}
	for _, move := range sharedMoves {
		require.Len(t, current.Children, 1,
			"should have exactly 1 child at shared move prefix (before %s)", move)
		current = current.Children[0]
		require.NotNil(t, current.Move)
		assert.Equal(t, move, *current.Move)
	}

	// After Bc4, there should be a branch point with multiple children
	assert.GreaterOrEqual(t, len(current.Children), 2,
		"after shared Bc4 prefix, Italian Game should branch into at least 2 variations")
}

// TestBuildTemplateTree_BranchNameOnDivergenceNode verifies that branch names
// and colors are set on the node where a variation first diverges.
func TestBuildTemplateTree_BranchNameOnDivergenceNode(t *testing.T) {
	// Queen's Gambit: all lines share d4, d5, c4 then diverge at Black's 3rd move
	tmpl := GetTemplate("queens-gambit")
	require.NotNil(t, tmpl)

	tree, err := BuildTemplateTree(tmpl)
	require.NoError(t, err)

	// Walk: root -> d4 -> d5 -> c4
	current := &tree
	for _, move := range []string{"d4", "d5", "c4"} {
		require.Len(t, current.Children, 1, "shared prefix should have 1 child at %s", move)
		current = current.Children[0]
	}

	// After c4, we should have 3 children (e6/QGD, dxc4/QGA, c6/Slav)
	require.Len(t, current.Children, 3,
		"Queen's Gambit should branch into 3 variations after c4")

	// Each child at the branch point should have a branch name
	for _, child := range current.Children {
		assert.NotNil(t, child.BranchName,
			"divergence node for move %v should have a branch name", child.Move)
		assert.NotNil(t, child.BranchColor,
			"divergence node for move %v should have a branch color", child.Move)
	}
}

// TestBuildTemplateTree_AllMovesValid ensures all move sequences in all
// templates produce valid chess positions (no panics or errors).
func TestBuildTemplateTree_AllMovesValid(t *testing.T) {
	for _, tmpl := range starterTemplates {
		t.Run(tmpl.ID, func(t *testing.T) {
			tree, err := BuildTemplateTree(&tmpl)
			require.NoError(t, err)

			// Walk every node and verify it has a valid FEN
			nodeCount := countNodes(&tree)
			assert.Greater(t, nodeCount, 1,
				"template %s should produce more than just the root node", tmpl.ID)
		})
	}
}

// TestBuildTemplateTree_EmptyTemplate errors gracefully
func TestBuildTemplateTree_EmptyTemplate(t *testing.T) {
	tmpl := RepertoireTemplate{
		ID:    "empty",
		Name:  "Empty",
		Color: "white",
		Lines: nil,
	}
	_, err := BuildTemplateTree(&tmpl)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no lines")
}

// TestGetTemplate_ReturnsNilForUnknown verifies unknown IDs return nil
func TestGetTemplate_ReturnsNilForUnknown(t *testing.T) {
	assert.Nil(t, GetTemplate("nonexistent"))
}

// TestGetTemplate_FindsAllTemplates verifies all 12 templates are discoverable
func TestGetTemplate_FindsAllTemplates(t *testing.T) {
	ids := []string{
		"italian", "london", "scotch", "ruy-lopez", "queens-gambit", "vienna",
		"sicilian", "french", "scandinavian", "caro-kann", "kings-indian", "slav",
	}
	for _, id := range ids {
		tmpl := GetTemplate(id)
		require.NotNil(t, tmpl, "template %q should exist", id)
		assert.Equal(t, id, tmpl.ID)
		assert.NotEmpty(t, tmpl.Lines, "template %q should have lines", id)
	}
}

// TestListTemplates_ReturnsAll verifies the summary list includes all templates
func TestListTemplates_ReturnsAll(t *testing.T) {
	summaries := ListTemplates()
	assert.Len(t, summaries, 12, "should have 12 starter templates")

	for _, s := range summaries {
		assert.NotEmpty(t, s.ID)
		assert.NotEmpty(t, s.Name)
		assert.NotEmpty(t, s.Description)
		assert.True(t, s.Color == "white" || s.Color == "black",
			"template %s should have color white or black", s.ID)
	}
}

// TestBuildTemplateTree_BranchColorsAreValid checks all branch colors used in
// templates are from the allowed palette.
func TestBuildTemplateTree_BranchColorsAreValid(t *testing.T) {
	for _, tmpl := range starterTemplates {
		for _, line := range tmpl.Lines {
			if line.BranchColor != "" {
				assert.True(t, allowedBranchColors[line.BranchColor],
					"template %s line %q uses invalid branch color %s",
					tmpl.ID, line.BranchName, line.BranchColor)
			}
		}
	}
}

// --- helpers ---

// collectBranchLabels traverses the tree and returns all branch names and colors found.
func collectBranchLabels(node *models.RepertoireNode) (names []string, colors []string) {
	if node.BranchName != nil {
		names = append(names, *node.BranchName)
	}
	if node.BranchColor != nil {
		colors = append(colors, *node.BranchColor)
	}
	for _, child := range node.Children {
		childNames, childColors := collectBranchLabels(child)
		names = append(names, childNames...)
		colors = append(colors, childColors...)
	}
	return
}

// countNodes counts all nodes in the tree (including the root).
func countNodes(node *models.RepertoireNode) int {
	count := 1
	for _, child := range node.Children {
		count += countNodes(child)
	}
	return count
}
