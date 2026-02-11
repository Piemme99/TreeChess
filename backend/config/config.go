package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

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

	// CORS allowed origins (comma-separated)
	allowedOrigins := []string{"http://localhost:5173"}
	originsStr := os.Getenv("CORS_ALLOWED_ORIGINS")
	if originsStr != "" {
		allowedOrigins = strings.Split(originsStr, ",")
		for i, origin := range allowedOrigins {
			allowedOrigins[i] = strings.TrimSpace(origin)
		}
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		panic("JWT_SECRET environment variable is required")
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
	}
}
