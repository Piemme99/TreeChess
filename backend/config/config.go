package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds application configuration
type Config struct {
	DatabaseURL    string
	Port           int
	AllowedOrigins []string
	YtdlpPath      string
	FfmpegPath     string
	JWTSecret      string
	JWTExpiry      time.Duration
}

// MustLoad loads configuration from environment variables
// Panics if required configuration is missing
func MustLoad() Config {
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

	ytdlpPath := os.Getenv("YTDLP_PATH")
	if ytdlpPath == "" {
		ytdlpPath = "yt-dlp"
	}

	ffmpegPath := os.Getenv("FFMPEG_PATH")
	if ffmpegPath == "" {
		ffmpegPath = "ffmpeg"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		panic("JWT_SECRET environment variable is required")
	}

	jwtExpiry := 168 * time.Hour // default 7 days
	jwtExpiryStr := os.Getenv("JWT_EXPIRY_HOURS")
	if jwtExpiryStr != "" {
		hours, err := strconv.Atoi(jwtExpiryStr)
		if err != nil {
			panic(fmt.Sprintf("Invalid JWT_EXPIRY_HOURS value: %s", jwtExpiryStr))
		}
		jwtExpiry = time.Duration(hours) * time.Hour
	}

	return Config{
		DatabaseURL:    dbURL,
		Port:           port,
		AllowedOrigins: allowedOrigins,
		YtdlpPath:      ytdlpPath,
		FfmpegPath:     ffmpegPath,
		JWTSecret:      jwtSecret,
		JWTExpiry:      jwtExpiry,
	}
}
