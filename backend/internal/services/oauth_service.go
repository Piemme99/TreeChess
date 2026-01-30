package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"golang.org/x/oauth2"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
)

var (
	ErrOAuthStateMismatch = fmt.Errorf("OAuth state mismatch")
	ErrOAuthAccountExists = fmt.Errorf("this account uses Lichess login")
)

type OAuthService struct {
	userRepo    repository.UserRepository
	authService *AuthService
	oauthConfig *oauth2.Config
}

func NewOAuthService(userRepo repository.UserRepository, authService *AuthService, clientID, redirectURL string) *OAuthService {
	cfg := &oauth2.Config{
		ClientID:    clientID,
		RedirectURL: redirectURL,
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://lichess.org/oauth",
			TokenURL: "https://lichess.org/api/token",
		},
		Scopes: []string{},
	}

	return &OAuthService{
		userRepo:    userRepo,
		authService: authService,
		oauthConfig: cfg,
	}
}

// GenerateAuthURL builds the Lichess authorization URL with PKCE parameters.
// Returns the URL, state, and code verifier.
func (s *OAuthService) GenerateAuthURL() (authURL, state, codeVerifier string, err error) {
	stateBytes := make([]byte, 16)
	if _, err := rand.Read(stateBytes); err != nil {
		return "", "", "", fmt.Errorf("failed to generate state: %w", err)
	}
	state = base64.URLEncoding.EncodeToString(stateBytes)

	verifierBytes := make([]byte, 32)
	if _, err := rand.Read(verifierBytes); err != nil {
		return "", "", "", fmt.Errorf("failed to generate code verifier: %w", err)
	}
	codeVerifier = base64.RawURLEncoding.EncodeToString(verifierBytes)

	challengeHash := sha256.Sum256([]byte(codeVerifier))
	codeChallenge := base64.RawURLEncoding.EncodeToString(challengeHash[:])

	authURL = s.oauthConfig.AuthCodeURL(state,
		oauth2.SetAuthURLParam("code_challenge_method", "S256"),
		oauth2.SetAuthURLParam("code_challenge", codeChallenge),
	)

	return authURL, state, codeVerifier, nil
}

// lichessAccount represents the Lichess /api/account response.
type lichessAccount struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

// HandleCallback exchanges the authorization code for a token and fetches the user profile.
func (s *OAuthService) HandleCallback(ctx context.Context, code, codeVerifier string) (username, lichessID string, err error) {
	token, err := s.oauthConfig.Exchange(ctx, code,
		oauth2.SetAuthURLParam("code_verifier", codeVerifier),
	)
	if err != nil {
		return "", "", fmt.Errorf("failed to exchange code: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "GET", "https://lichess.org/api/account", nil)
	if err != nil {
		return "", "", fmt.Errorf("failed to create account request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("failed to fetch Lichess account: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", "", fmt.Errorf("Lichess account request failed (%d): %s", resp.StatusCode, string(body))
	}

	var account lichessAccount
	if err := json.NewDecoder(resp.Body).Decode(&account); err != nil {
		return "", "", fmt.Errorf("failed to decode Lichess account: %w", err)
	}

	return account.Username, account.ID, nil
}

// FindOrCreateUser looks up an existing OAuth user or creates a new one, then returns a JWT.
func (s *OAuthService) FindOrCreateUser(provider, oauthID, username string) (*models.AuthResponse, error) {
	user, err := s.userRepo.FindByOAuth(provider, oauthID)
	if err != nil && err != repository.ErrUserNotFound {
		return nil, fmt.Errorf("failed to find OAuth user: %w", err)
	}

	if user == nil {
		// Check if username already exists and append suffix if needed
		finalUsername := username
		for i := 1; ; i++ {
			exists, err := s.userRepo.Exists(finalUsername)
			if err != nil {
				return nil, fmt.Errorf("failed to check username: %w", err)
			}
			if !exists {
				break
			}
			finalUsername = fmt.Sprintf("%s_%d", username, i)
		}

		user, err = s.userRepo.CreateOAuth(provider, oauthID, finalUsername)
		if err != nil {
			return nil, fmt.Errorf("failed to create OAuth user: %w", err)
		}
	}

	token, err := s.authService.generateToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	return &models.AuthResponse{Token: token, User: *user}, nil
}
