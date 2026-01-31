package config

import (
	"testing"
)

func TestMustLoad_PanicOnMissingDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("JWT_SECRET", "test-secret")

	defer func() {
		if r := recover(); r == nil {
			t.Error("Expected panic when DATABASE_URL is missing")
		}
	}()
	MustLoad()
}

func TestMustLoad_DefaultPort(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/db")
	t.Setenv("JWT_SECRET", "test-secret-key-for-jwt")
	t.Setenv("PORT", "")

	cfg := MustLoad()

	if cfg.DatabaseURL != "postgres://user:pass@localhost:5432/db" {
		t.Errorf("Expected DATABASE_URL to be set, got: %s", cfg.DatabaseURL)
	}
	if cfg.Port != 8080 {
		t.Errorf("Expected default port 8080, got: %d", cfg.Port)
	}
}

func TestMustLoad_CustomPort(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/db")
	t.Setenv("JWT_SECRET", "test-secret-key-for-jwt")
	t.Setenv("PORT", "9090")

	cfg := MustLoad()

	if cfg.Port != 9090 {
		t.Errorf("Expected port 9090, got: %d", cfg.Port)
	}
}

func TestMustLoad_InvalidPort(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/db")
	t.Setenv("JWT_SECRET", "test-secret-key-for-jwt")
	t.Setenv("PORT", "invalid")

	defer func() {
		if r := recover(); r == nil {
			t.Error("Expected panic on invalid PORT")
		}
	}()
	MustLoad()
}

func TestMustLoad_PanicOnMissingJWTSecret(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/db")
	t.Setenv("JWT_SECRET", "")

	defer func() {
		if r := recover(); r == nil {
			t.Error("Expected panic when JWT_SECRET is missing")
		}
	}()
	MustLoad()
}

func TestMustLoad_CustomJWTExpiry(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/db")
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("JWT_EXPIRY_HOURS", "24")
	t.Setenv("PORT", "")

	cfg := MustLoad()

	if cfg.JWTExpiry.Hours() != 24 {
		t.Errorf("Expected JWT expiry 24h, got: %v", cfg.JWTExpiry)
	}
}

func TestMustLoad_DefaultAllowedOrigins(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/db")
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("CORS_ALLOWED_ORIGINS", "")
	t.Setenv("PORT", "")

	cfg := MustLoad()

	if len(cfg.AllowedOrigins) != 1 || cfg.AllowedOrigins[0] != "http://localhost:5173" {
		t.Errorf("Expected default allowed origins, got: %v", cfg.AllowedOrigins)
	}
}

func TestMustLoad_CustomAllowedOrigins(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/db")
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://example.com, https://other.com")
	t.Setenv("PORT", "")

	cfg := MustLoad()

	if len(cfg.AllowedOrigins) != 2 {
		t.Errorf("Expected 2 allowed origins, got: %d", len(cfg.AllowedOrigins))
	}
}
