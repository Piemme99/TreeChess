package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds application configuration
type Config struct {
	DatabaseURL    string
	Port           int
	AllowedOrigins []string
	YtdlpPath     string
	FfmpegPath    string
	PythonPath    string
	ScriptPath    string
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

	pythonPath := os.Getenv("PYTHON_PATH")
	if pythonPath == "" {
		pythonPath = "python3"
	}

	scriptPath := os.Getenv("SCRIPT_PATH")
	if scriptPath == "" {
		scriptPath = "scripts/recognize_positions.py"
	}

	return Config{
		DatabaseURL:    dbURL,
		Port:           port,
		AllowedOrigins: allowedOrigins,
		YtdlpPath:     ytdlpPath,
		FfmpegPath:    ffmpegPath,
		PythonPath:    pythonPath,
		ScriptPath:    scriptPath,
	}
}
