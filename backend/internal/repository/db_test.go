package repository

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/treechess/backend/config"
)

func TestInitDB_InvalidURL(t *testing.T) {
	cfg := config.Config{
		DatabaseURL: "invalid-url",
		Port:        8080,
	}

	err := InitDB(cfg)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to create connection pool")
}

func TestGetPool_NotInitialized(t *testing.T) {
	pool = nil

	result := GetPool()

	assert.Nil(t, result)
}

func TestCloseDB(t *testing.T) {
	os.Setenv("DATABASE_URL", "postgres://test:test@localhost:5432/test?sslmode=disable")
	defer os.Unsetenv("DATABASE_URL")

	cfg := config.MustLoad()
	InitDB(cfg)

	poolBefore := GetPool()
	require.NotNil(t, poolBefore)

	CloseDB()
	pool = nil

	result := GetPool()
	assert.Nil(t, result)
}
