package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
)

var (
	ErrUnauthorized = fmt.Errorf("unauthorized")
	// ErrUsernameMismatch : la suppression du compte se confirme en retapant son nom.
	ErrUsernameMismatch = fmt.Errorf("username confirmation does not match")
)

type AuthService struct {
	userRepo           repository.UserRepository
	refreshTokenRepo   repository.RefreshTokenRepository
	jwtSecret          []byte
	jwtExpiry          time.Duration
	refreshTokenExpiry time.Duration
}

func NewAuthService(userRepo repository.UserRepository, jwtSecret string, jwtExpiry time.Duration) *AuthService {
	return &AuthService{
		userRepo:           userRepo,
		jwtSecret:          []byte(jwtSecret),
		jwtExpiry:          jwtExpiry,
		refreshTokenExpiry: 30 * 24 * time.Hour, // 30 days
	}
}

// WithRefreshTokens sets up refresh token dependencies
func (s *AuthService) WithRefreshTokens(repo repository.RefreshTokenRepository) {
	s.refreshTokenRepo = repo
}

func (s *AuthService) ValidateToken(ctx context.Context, tokenStr string) (string, error) {
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return "", ErrUnauthorized
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return "", ErrUnauthorized
	}

	sub, ok := claims["sub"].(string)
	if !ok || sub == "" {
		return "", ErrUnauthorized
	}

	// Le jeton d'un compte supprimé ne doit plus rien ouvrir pendant ses 15 minutes restantes.
	if _, err := s.userRepo.GetByID(ctx, sub); err != nil {
		return "", ErrUnauthorized
	}

	return sub, nil
}

func (s *AuthService) GetUserByID(ctx context.Context, id string) (*models.User, error) {
	return s.userRepo.GetByID(ctx, id)
}

func (s *AuthService) generateToken(user *models.User) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":      user.ID,
		"username": user.Username,
		"iat":      now.Unix(),
		"exp":      now.Add(s.jwtExpiry).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

// DeleteAccount deletes the user and all their data once the typed username
// matches the account's.
func (s *AuthService) DeleteAccount(ctx context.Context, userID, username string) error {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	if username == "" || username != user.Username {
		return ErrUsernameMismatch
	}

	if err := s.userRepo.Delete(ctx, userID); err != nil {
		return fmt.Errorf("failed to delete account: %w", err)
	}
	return nil
}

// RefreshTokens validates a refresh token, rotates it, and returns a new token pair.
//
// On rotation the old token is marked consumed (not deleted) so its user remains
// resolvable. Presenting an already-consumed token indicates reuse/theft and revokes
// the entire token family for that user. A genuinely unknown token (never issued)
// returns ErrUnauthorized without revocation, since no user can be resolved from it.
func (s *AuthService) RefreshTokens(ctx context.Context, rawRefreshToken string) (*models.AuthResponse, error) {
	if s.refreshTokenRepo == nil {
		return nil, ErrUnauthorized
	}

	tokenHash := hashToken(rawRefreshToken)
	storedToken, err := s.refreshTokenRepo.GetByTokenHash(ctx, tokenHash)
	if err != nil {
		// Token never issued (or already purged). No user can be resolved, so we
		// just return unauthorized without revoking anything.
		return nil, ErrUnauthorized
	}

	// Reuse/theft detection: a consumed token was already rotated out. Replaying it
	// signals the token was stolen, so revoke the whole family for this user.
	if storedToken.Consumed {
		if revokeErr := s.RevokeAllRefreshTokens(ctx, storedToken.UserID); revokeErr != nil {
			slog.Error("failed to revoke refresh token family on reuse", "user_id", storedToken.UserID, "error", revokeErr)
		}
		return nil, ErrUnauthorized
	}

	// Check expiry
	if time.Now().After(storedToken.ExpiresAt) {
		// Clean up the expired token
		_ = s.refreshTokenRepo.Delete(ctx, storedToken.ID)
		return nil, ErrUnauthorized
	}

	// Consume the old refresh token (single-use rotation). The row is retained so a
	// replay of this token can be detected as reuse above. The update is conditional
	// on consumed=false, so of two concurrent rotations of the same token exactly one
	// wins; the loser means the token was presented twice — treat it as reuse/theft.
	if err := s.refreshTokenRepo.MarkConsumed(ctx, storedToken.ID); err != nil {
		if errors.Is(err, repository.ErrRefreshTokenNotFound) {
			if revokeErr := s.RevokeAllRefreshTokens(ctx, storedToken.UserID); revokeErr != nil {
				slog.Error("failed to revoke refresh token family on concurrent reuse", "user_id", storedToken.UserID, "error", revokeErr)
			}
			return nil, ErrUnauthorized
		}
		return nil, fmt.Errorf("failed to rotate refresh token: %w", err)
	}

	// Fetch user
	user, err := s.userRepo.GetByID(ctx, storedToken.UserID)
	if err != nil {
		return nil, ErrUnauthorized
	}

	// Generate new access token
	accessToken, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	// Generate new refresh token
	newRawRefresh, err := s.createRefreshToken(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to create new refresh token: %w", err)
	}

	return &models.AuthResponse{
		Token:        accessToken,
		RefreshToken: newRawRefresh,
		User:         *user,
	}, nil
}

// RevokeRefreshToken revokes a single refresh token (used during logout)
func (s *AuthService) RevokeRefreshToken(ctx context.Context, rawRefreshToken string) error {
	if s.refreshTokenRepo == nil {
		return nil
	}

	tokenHash := hashToken(rawRefreshToken)
	storedToken, err := s.refreshTokenRepo.GetByTokenHash(ctx, tokenHash)
	if err != nil {
		return nil //nolint:nilerr // intentional: token already gone or invalid, that's fine
	}

	return s.refreshTokenRepo.Delete(ctx, storedToken.ID)
}

// RevokeAllRefreshTokens revokes all refresh tokens for a user (used on refresh token reuse)
func (s *AuthService) RevokeAllRefreshTokens(ctx context.Context, userID string) error {
	if s.refreshTokenRepo == nil {
		return nil
	}
	return s.refreshTokenRepo.DeleteByUserID(ctx, userID)
}

// CreateRefreshTokenForUser generates a new refresh token for the given user.
// Returns the raw token string (to be sent to the client) or an error.
// Returns empty string with nil error if refresh tokens are not configured.
func (s *AuthService) CreateRefreshTokenForUser(ctx context.Context, userID string) (string, error) {
	if s.refreshTokenRepo == nil {
		return "", nil
	}
	return s.createRefreshToken(ctx, userID)
}

// createRefreshToken generates a new refresh token, stores its hash, and returns the raw token
func (s *AuthService) createRefreshToken(ctx context.Context, userID string) (string, error) {
	rawToken, err := generateSecureToken(32)
	if err != nil {
		return "", fmt.Errorf("failed to generate refresh token: %w", err)
	}

	tokenHash := hashToken(rawToken)
	expiresAt := time.Now().Add(s.refreshTokenExpiry)

	_, err = s.refreshTokenRepo.Create(ctx, userID, tokenHash, expiresAt)
	if err != nil {
		return "", fmt.Errorf("failed to store refresh token: %w", err)
	}

	return rawToken, nil
}

// generateSecureToken generates a cryptographically secure random token
func generateSecureToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// hashToken creates a SHA-256 hash of the token
func hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
