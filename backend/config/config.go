package config

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// minJWTSecretBytes is the minimum JWT_SECRET length enforced in production. It
// matches the 32-byte (256-bit) HS256 signing key and the HKDF-derived 32-byte
// AES key used for OAuth-state cookie encryption.
const minJWTSecretBytes = 32

// Config holds application configuration
type Config struct {
	Environment              string
	DatabaseURL              string
	Port                     int
	AllowedOrigins           []string
	JWTSecret                string
	JWTExpiry                time.Duration
	LichessClientID          string
	FrontendURL              string
	OAuthCallbackURL         string
	SecureCookies            bool
	SMTPHost                 string
	SMTPPort                 int
	SMTPUser                 string
	SMTPPassword             string
	SMTPFromAddress          string
	PasswordResetExpiryHours int
	MetricsPort              int
	LichessExplorerBaseURL   string
	LichessExplorerCacheTTL  time.Duration
	CleanupInterval          time.Duration
}

// MustLoad loads configuration from environment variables
// Panics if required configuration is missing
func MustLoad() Config {
	// Load .env file if present (won't override existing env vars)
	_ = godotenv.Load("../.env")

	env := os.Getenv("ENVIRONMENT")
	if env == "" {
		env = "development"
	}
	isProduction := env == "production"

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		panic("DATABASE_URL environment variable is required")
	}

	portStr := os.Getenv("PORT")
	port := 8080
	if portStr != "" {
		p, err := strconv.Atoi(portStr)
		if err != nil {
			panic(fmt.Sprintf("Invalid PORT value: %s", portStr))
		}
		port = p
	}

	// CORS allowed origins (comma-separated). The server sets
	// AllowCredentials: true, and the Fetch spec forbids combining a wildcard
	// origin with credentials, so reject any "*" entry outright.
	allowedOrigins := []string{"http://localhost:5173"}
	originsStr := os.Getenv("CORS_ALLOWED_ORIGINS")
	if originsStr != "" {
		allowedOrigins = strings.Split(originsStr, ",")
		for i, origin := range allowedOrigins {
			allowedOrigins[i] = strings.TrimSpace(origin)
		}
	}
	for _, origin := range allowedOrigins {
		if origin == "*" {
			panic("CORS_ALLOWED_ORIGINS cannot contain '*' because credentials are enabled (the Fetch spec forbids combining a wildcard origin with credentials)")
		}
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		panic("JWT_SECRET environment variable is required")
	}
	// JWT_SECRET signs HS256 tokens and seeds the HKDF-derived OAuth cookie
	// encryption key; a weak secret makes brute-force token forgery feasible.
	// Enforce a minimum length in production, warn elsewhere so dev/test secrets
	// keep working.
	if len(jwtSecret) < minJWTSecretBytes {
		if isProduction {
			panic(fmt.Sprintf("JWT_SECRET must be at least %d bytes in production, got %d", minJWTSecretBytes, len(jwtSecret)))
		}
		slog.Warn("JWT_SECRET is shorter than recommended; use at least the minimum in production",
			"length", len(jwtSecret), "minimum", minJWTSecretBytes)
	}

	jwtExpiry := 15 * time.Minute // default 15 minutes (short-lived, refresh token used for renewal)
	if jwtExpiryMinStr := os.Getenv("JWT_EXPIRY_MINUTES"); jwtExpiryMinStr != "" {
		mins, err := strconv.Atoi(jwtExpiryMinStr)
		if err != nil {
			panic(fmt.Sprintf("Invalid JWT_EXPIRY_MINUTES value: %s", jwtExpiryMinStr))
		}
		jwtExpiry = time.Duration(mins) * time.Minute
	} else if jwtExpiryStr := os.Getenv("JWT_EXPIRY_HOURS"); jwtExpiryStr != "" {
		hours, err := strconv.Atoi(jwtExpiryStr)
		if err != nil {
			panic(fmt.Sprintf("Invalid JWT_EXPIRY_HOURS value: %s", jwtExpiryStr))
		}
		jwtExpiry = time.Duration(hours) * time.Hour
	}

	lichessClientID := os.Getenv("LICHESS_CLIENT_ID")

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:5173"
	}

	oauthCallbackURL := os.Getenv("OAUTH_CALLBACK_URL")
	if oauthCallbackURL == "" {
		oauthCallbackURL = fmt.Sprintf("http://localhost:%d/api/auth/lichess/callback", port)
	}

	secureCookies := os.Getenv("SECURE_COOKIES") == "true"
	// The 30-day refresh cookie and the OAuth-state cookie inherit Secure from
	// this flag. Shipping them over plain HTTP in production would leak a
	// long-lived credential, so fail fast; warn in non-production.
	if !secureCookies {
		if isProduction {
			panic("SECURE_COOKIES must be 'true' in production to protect the refresh and OAuth-state cookies")
		}
		slog.Warn("SECURE_COOKIES is not enabled; cookies will be sent over plain HTTP (acceptable for local development only)")
	}

	// SMTP config (optional - if not set, email sending is disabled)
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := 587
	if smtpPortStr := os.Getenv("SMTP_PORT"); smtpPortStr != "" {
		p, err := strconv.Atoi(smtpPortStr)
		if err != nil {
			panic(fmt.Sprintf("Invalid SMTP_PORT value: %s", smtpPortStr))
		}
		smtpPort = p
	}
	smtpUser := os.Getenv("SMTP_USER")
	smtpPassword := os.Getenv("SMTP_PASSWORD")
	smtpFromAddress := os.Getenv("SMTP_FROM_ADDRESS")

	metricsPort := 9090
	if metricsPortStr := os.Getenv("METRICS_PORT"); metricsPortStr != "" {
		p, err := strconv.Atoi(metricsPortStr)
		if err != nil {
			panic(fmt.Sprintf("Invalid METRICS_PORT value: %s", metricsPortStr))
		}
		metricsPort = p
	}

	passwordResetExpiryHours := 1
	if expiryStr := os.Getenv("PASSWORD_RESET_EXPIRY_HOURS"); expiryStr != "" {
		hours, err := strconv.Atoi(expiryStr)
		if err != nil {
			panic(fmt.Sprintf("Invalid PASSWORD_RESET_EXPIRY_HOURS value: %s", expiryStr))
		}
		passwordResetExpiryHours = hours
	}

	explorerBaseURL := os.Getenv("LICHESS_EXPLORER_BASE_URL")
	if explorerBaseURL == "" {
		explorerBaseURL = "https://explorer.lichess.org"
	}
	explorerCacheTTL := 7 * 24 * time.Hour
	if ttlStr := os.Getenv("LICHESS_EXPLORER_CACHE_TTL_HOURS"); ttlStr != "" {
		hours, err := strconv.Atoi(ttlStr)
		if err != nil {
			panic(fmt.Sprintf("Invalid LICHESS_EXPLORER_CACHE_TTL_HOURS value: %s", ttlStr))
		}
		explorerCacheTTL = time.Duration(hours) * time.Hour
	}

	// Interval at which the background worker purges expired refresh/reset
	// tokens and stale opening-explorer cache rows.
	cleanupInterval := time.Hour
	if intervalStr := os.Getenv("CLEANUP_INTERVAL_MINUTES"); intervalStr != "" {
		mins, err := strconv.Atoi(intervalStr)
		if err != nil {
			panic(fmt.Sprintf("Invalid CLEANUP_INTERVAL_MINUTES value: %s", intervalStr))
		}
		if mins <= 0 {
			panic(fmt.Sprintf("CLEANUP_INTERVAL_MINUTES must be positive, got: %d", mins))
		}
		cleanupInterval = time.Duration(mins) * time.Minute
	}

	return Config{
		Environment:              env,
		DatabaseURL:              dbURL,
		Port:                     port,
		AllowedOrigins:           allowedOrigins,
		JWTSecret:                jwtSecret,
		JWTExpiry:                jwtExpiry,
		LichessClientID:          lichessClientID,
		FrontendURL:              frontendURL,
		OAuthCallbackURL:         oauthCallbackURL,
		SecureCookies:            secureCookies,
		SMTPHost:                 smtpHost,
		SMTPPort:                 smtpPort,
		SMTPUser:                 smtpUser,
		SMTPPassword:             smtpPassword,
		SMTPFromAddress:          smtpFromAddress,
		PasswordResetExpiryHours: passwordResetExpiryHours,
		MetricsPort:              metricsPort,
		LichessExplorerBaseURL:   explorerBaseURL,
		LichessExplorerCacheTTL:  explorerCacheTTL,
		CleanupInterval:          cleanupInterval,
	}
}
