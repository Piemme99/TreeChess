package repository

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/treechess/backend/config"
)

func TestNewDB_InvalidURL(t *testing.T) {
	cfg := config.Config{
		DatabaseURL: "invalid-url",
		Port:        8080,
	}

	db, err := NewDB(cfg)

	assert.Error(t, err)
	assert.Nil(t, db)
	assert.Contains(t, err.Error(), "failed to create connection pool")
}

func TestDB_Close_NilPool(t *testing.T) {
	// Test that Close doesn't panic when pool is nil
	db := &DB{Pool: nil}
	db.Close() // Should not panic
}
