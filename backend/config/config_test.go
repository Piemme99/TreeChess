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

// strongSecret is at least minJWTSecretBytes long so production validation
// passes when the test is exercising some other production guard.
const strongSecret = "this-is-a-32-byte-or-longer-secret-value"

// TestMustLoad_ProductionSecurityGuards exercises the fail-fast production
// guards added for issue #125: insecure cookies, weak JWT secret, and wildcard
// CORS origin combined with credentials. Non-production cases confirm the
// guards stay advisory (warn-only) so local/dev configs keep working.
func TestMustLoad_ProductionSecurityGuards(t *testing.T) {
	tests := []struct {
		name        string
		environment string
		secret      string
		secure      string
		origins     string
		wantPanic   bool
	}{
		{
			name:        "prod with insecure cookies panics",
			environment: "production",
			secret:      strongSecret,
			secure:      "false",
			origins:     "https://example.com",
			wantPanic:   true,
		},
		{
			name:        "prod with short secret panics",
			environment: "production",
			secret:      "too-short",
			secure:      "true",
			origins:     "https://example.com",
			wantPanic:   true,
		},
		{
			name:        "prod with valid config passes",
			environment: "production",
			secret:      strongSecret,
			secure:      "true",
			origins:     "https://example.com",
			wantPanic:   false,
		},
		{
			name:        "dev with short secret does not panic",
			environment: "development",
			secret:      "too-short",
			secure:      "false",
			origins:     "https://example.com",
			wantPanic:   false,
		},
		{
			name:        "wildcard origin with credentials panics",
			environment: "production",
			secret:      strongSecret,
			secure:      "true",
			origins:     "https://example.com,*",
			wantPanic:   true,
		},
		{
			name:        "wildcard origin panics even in development",
			environment: "development",
			secret:      strongSecret,
			secure:      "false",
			origins:     "*",
			wantPanic:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/db")
			t.Setenv("JWT_SECRET", tt.secret)
			t.Setenv("ENVIRONMENT", tt.environment)
			t.Setenv("SECURE_COOKIES", tt.secure)
			t.Setenv("CORS_ALLOWED_ORIGINS", tt.origins)
			t.Setenv("PORT", "")

			defer func() {
				r := recover()
				if tt.wantPanic && r == nil {
					t.Errorf("expected panic but MustLoad returned normally")
				}
				if !tt.wantPanic && r != nil {
					t.Errorf("did not expect panic, got: %v", r)
				}
			}()

			cfg := MustLoad()
			if !tt.wantPanic {
				if tt.secure == "true" && !cfg.SecureCookies {
					t.Errorf("expected SecureCookies true, got false")
				}
			}
		})
	}
}
