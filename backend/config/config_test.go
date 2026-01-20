package config

import (
	"os"
	"testing"
)

func TestMustLoad_PanicOnMissingDatabaseURL(t *testing.T) {
	os.Unsetenv("DATABASE_URL")
	os.Unsetenv("PORT")

	defer func() {
		if r := recover(); r == nil {
			t.Error("Expected panic when DATABASE_URL is missing")
		}
	}()
	MustLoad()
}

func TestMustLoad_DefaultPort(t *testing.T) {
	os.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/db")
	os.Unsetenv("PORT")

	cfg := MustLoad()

	if cfg.DatabaseURL != "postgres://user:pass@localhost:5432/db" {
		t.Errorf("Expected DATABASE_URL to be set, got: %s", cfg.DatabaseURL)
	}
	if cfg.Port != 8080 {
		t.Errorf("Expected default port 8080, got: %d", cfg.Port)
	}
}

func TestMustLoad_CustomPort(t *testing.T) {
	os.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/db")
	os.Setenv("PORT", "9090")

	cfg := MustLoad()

	if cfg.Port != 9090 {
		t.Errorf("Expected port 9090, got: %d", cfg.Port)
	}
}

func TestMustLoad_InvalidPort(t *testing.T) {
	os.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/db")
	os.Setenv("PORT", "invalid")

	defer func() {
		if r := recover(); r == nil {
			t.Error("Expected panic on invalid PORT")
		}
	}()
	MustLoad()
}
