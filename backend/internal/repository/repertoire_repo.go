package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/treechess/backend/internal/models"
)

const (
	getRepertoireByColorSQL = `
		SELECT id, color, tree_data, metadata, created_at, updated_at
		FROM repertoires
		WHERE color = $1
	`
	createRepertoireSQL = `
		INSERT INTO repertoires (id, color, tree_data, metadata)
		VALUES ($1, $2, $3, $4)
		RETURNING id, color, tree_data, metadata, created_at, updated_at
	`
	updateRepertoireSQL = `
		UPDATE repertoires
		SET tree_data = $2, metadata = $3, updated_at = NOW()
		WHERE color = $1
		RETURNING id, color, tree_data, metadata, created_at, updated_at
	`
	checkRepertoireExistsSQL = `
		SELECT EXISTS(SELECT 1 FROM repertoires WHERE color = $1)
	`
)

func GetRepertoireByColor(color models.Color) (*models.Repertoire, error) {
	db := GetPool()
	ctx := context.Background()

	var rep models.Repertoire
	var treeDataJSON, metadataJSON []byte

	err := db.QueryRow(ctx, getRepertoireByColorSQL, string(color)).Scan(
		&rep.ID,
		&rep.Color,
		&treeDataJSON,
		&metadataJSON,
		&rep.CreatedAt,
		&rep.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("repertoire not found: %w", err)
	}

	if err := json.Unmarshal(treeDataJSON, &rep.TreeData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tree_data: %w", err)
	}

	if err := json.Unmarshal(metadataJSON, &rep.Metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	return &rep, nil
}

func CreateRepertoire(color models.Color) (*models.Repertoire, error) {
	db := GetPool()
	ctx := context.Background()

	rootNode := models.RepertoireNode{
		ID:          uuid.New().String(),
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		MoveNumber:  0,
		ColorToMove: models.ColorWhite,
		ParentID:    nil,
		Children:    nil,
	}

	metadata := models.Metadata{
		TotalNodes:   1,
		TotalMoves:   0,
		DeepestDepth: 0,
	}

	treeDataJSON, err := json.Marshal(rootNode)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal tree_data: %w", err)
	}

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal metadata: %w", err)
	}

	rep := models.Repertoire{
		ID:        uuid.New().String(),
		Color:     color,
		TreeData:  rootNode,
		Metadata:  metadata,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	err = db.QueryRow(ctx, createRepertoireSQL,
		rep.ID,
		string(rep.Color),
		treeDataJSON,
		metadataJSON,
	).Scan(
		&rep.ID,
		&rep.Color,
		&treeDataJSON,
		&metadataJSON,
		&rep.CreatedAt,
		&rep.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create repertoire: %w", err)
	}

	return &rep, nil
}

func SaveRepertoire(color models.Color, treeData models.RepertoireNode, metadata models.Metadata) (*models.Repertoire, error) {
	db := GetPool()
	ctx := context.Background()

	treeDataJSON, err := json.Marshal(treeData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal tree_data: %w", err)
	}

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal metadata: %w", err)
	}

	var rep models.Repertoire
	var newTreeDataJSON, newMetadataJSON []byte

	err = db.QueryRow(ctx, updateRepertoireSQL,
		string(color),
		treeDataJSON,
		metadataJSON,
	).Scan(
		&rep.ID,
		&rep.Color,
		&newTreeDataJSON,
		&newMetadataJSON,
		&rep.CreatedAt,
		&rep.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to save repertoire: %w", err)
	}

	if err := json.Unmarshal(newTreeDataJSON, &rep.TreeData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tree_data: %w", err)
	}

	if err := json.Unmarshal(newMetadataJSON, &rep.Metadata); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
	}

	return &rep, nil
}

func RepertoireExists(color models.Color) (bool, error) {
	db := GetPool()
	ctx := context.Background()

	var exists bool
	err := db.QueryRow(ctx, checkRepertoireExistsSQL, string(color)).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}
