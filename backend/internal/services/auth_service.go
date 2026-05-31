package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
)

var usernamePattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{3,50}$`)
var emailPattern = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

var (
	ErrInvalidUsername      = fmt.Errorf("username must be 3-50 alphanumeric characters, hyphens or underscores")
	ErrInvalidEmail         = fmt.Errorf("invalid email format")
	ErrPasswordTooShort     = fmt.Errorf("password must be at least 8 characters")
	ErrInvalidCredentials   = fmt.Errorf("invalid credentials")
	ErrUnauthorized         = fmt.Errorf("unauthorized")
	ErrOAuthOnly            = fmt.Errorf("this account uses Lichess login")
	ErrResetTokenExpired    = fmt.Errorf("reset token has expired")
	ErrResetTokenInvalid    = fmt.Errorf("reset token is invalid")
	ErrResetTokenUsed       = fmt.Errorf("reset token has already been used")
	ErrIncorrectPassword    = fmt.Errorf("current password is incorrect")
	ErrNoPassword           = fmt.Errorf("this account does not have a password set")
	ErrTooManyResetRequests = fmt.Errorf("too many password reset requests")
)

type AuthService struct {
	userRepo           repository.UserRepository
	resetRepo          repository.PasswordResetRepository
	refreshTokenRepo   repository.RefreshTokenRepository
	emailService       EmailSender
	jwtSecret          []byte
	jwtExpiry          time.Duration
	refreshTokenExpiry time.Duration
	resetTokenExpiry   time.Duration
	maxResetPerHour    int
}

func NewAuthService(userRepo repository.UserRepository, jwtSecret string, jwtExpiry time.Duration) *AuthService {
	return &AuthService{
		userRepo:           userRepo,
		jwtSecret:          []byte(jwtSecret),
		jwtExpiry:          jwtExpiry,
		refreshTokenExpiry: 30 * 24 * time.Hour, // 30 days
		resetTokenExpiry:   1 * time.Hour,
		maxResetPerHour:    3,
	}
}

// WithRefreshTokens sets up refresh token dependencies
func (s *AuthService) WithRefreshTokens(repo repository.RefreshTokenRepository) {
	s.refreshTokenRepo = repo
}

// WithPasswordReset sets up password reset dependencies
func (s *AuthService) WithPasswordReset(resetRepo repository.PasswordResetRepository, emailService EmailSender, expiryHours int) {
	s.resetRepo = resetRepo
	s.emailService = emailService
	if expiryHours > 0 {
		s.resetTokenExpiry = time.Duration(expiryHours) * time.Hour
	}
}

func (s *AuthService) Register(ctx context.Context, email, username, password string) (*models.AuthResponse, error) {
	if !emailPattern.MatchString(email) {
		return nil, ErrInvalidEmail
	}
	if !usernamePattern.MatchString(username) {
		return nil, ErrInvalidUsername
	}
	if len(password) < 8 {
		return nil, ErrPasswordTooShort
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user, err := s.userRepo.Create(ctx, email, username, string(hash))
	if err != nil {
		return nil, err
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	resp := &models.AuthResponse{Token: token, User: *user}

	// Generate refresh token if the repository is configured
	if s.refreshTokenRepo != nil {
		rawRefresh, err := s.createRefreshToken(ctx, user.ID)
		if err != nil {
			slog.Error("failed to create refresh token during register", "user_id", user.ID, "error", err)
		} else {
			resp.RefreshToken = rawRefresh
		}
	}

	return resp, nil
}

func (s *AuthService) Login(ctx context.Context, email, password string) (*models.AuthResponse, error) {
	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	if user.PasswordHash == "" && user.OAuthProvider != nil {
		return nil, ErrOAuthOnly
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	resp := &models.AuthResponse{Token: token, User: *user}

	// Generate refresh token if the repository is configured
	if s.refreshTokenRepo != nil {
		rawRefresh, err := s.createRefreshToken(ctx, user.ID)
		if err != nil {
			slog.Error("failed to create refresh token during login", "user_id", user.ID, "error", err)
		} else {
			resp.RefreshToken = rawRefresh
		}
	}

	return resp, nil
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

	// Check if the token was issued before the last password change
	if iat, ok := claims["iat"].(float64); ok {
		user, err := s.userRepo.GetByID(ctx, sub)
		if err != nil {
			return "", ErrUnauthorized
		}
		if user.PasswordChangedAt != nil {
			issuedAt := time.Unix(int64(iat), 0)
			if issuedAt.Before(*user.PasswordChangedAt) {
				return "", ErrUnauthorized
			}
		}
	}

	return sub, nil
}

func (s *AuthService) GetUserByID(ctx context.Context, id string) (*models.User, error) {
	return s.userRepo.GetByID(ctx, id)
}

func (s *AuthService) UpdateProfile(ctx context.Context, userID string, req models.UpdateProfileRequest) (*models.User, error) {
	// Validate external platform usernames before they are stored and later
	// interpolated into outbound API request paths. Empty/nil values clear the
	// linkage and are allowed; non-empty values must match the username pattern.
	if req.LichessUsername != nil && *req.LichessUsername != "" && !usernamePattern.MatchString(*req.LichessUsername) {
		return nil, ErrInvalidUsername
	}
	if req.ChesscomUsername != nil && *req.ChesscomUsername != "" && !usernamePattern.MatchString(*req.ChesscomUsername) {
		return nil, ErrInvalidUsername
	}

	// Check if new time formats were added — if so, reset sync timestamps
	// so the next sync does a full re-fetch with the expanded format list
	if len(req.TimeFormatPrefs) > 0 {
		currentUser, err := s.userRepo.GetByID(ctx, userID)
		if err == nil && hasNewTimeFormats(currentUser.TimeFormatPrefs, req.TimeFormatPrefs) {
			if err := s.userRepo.ResetSyncTimestamps(ctx, userID); err != nil {
				slog.Error("failed to reset sync timestamps after time format change", "user_id", userID, "error", err)
			}
		}
	}

	return s.userRepo.UpdateProfile(ctx, userID, req.LichessUsername, req.ChesscomUsername, req.TimeFormatPrefs)
}

// hasNewTimeFormats returns true if newPrefs contains formats not present in oldPrefs.
func hasNewTimeFormats(oldPrefs, newPrefs []string) bool {
	old := make(map[string]bool, len(oldPrefs))
	for _, f := range oldPrefs {
		old[f] = true
	}
	for _, f := range newPrefs {
		if !old[f] {
			return true
		}
	}
	return false
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

// RequestPasswordReset initiates the password reset flow
// Always returns nil to prevent email enumeration
func (s *AuthService) RequestPasswordReset(ctx context.Context, email string) error {
	if s.resetRepo == nil || s.emailService == nil {
		return nil // Silent fail if not configured
	}

	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil //nolint:nilerr // intentional: don't reveal whether the email exists
	}

	// Check if user has a password (OAuth-only users can't reset password)
	if user.PasswordHash == "" {
		return nil
	}

	// Rate limiting: max 3 requests per hour
	since := time.Now().Add(-1 * time.Hour)
	count, err := s.resetRepo.CountRecentByUserID(ctx, user.ID, since)
	if err != nil {
		return nil //nolint:nilerr // intentional: silent fail for rate-limit check
	}
	if count >= s.maxResetPerHour {
		return nil // Silent fail to prevent enumeration
	}

	// Generate secure token
	rawToken, err := generateSecureToken(32)
	if err != nil {
		return nil //nolint:nilerr // intentional: silent fail to avoid leaking internal errors
	}

	// Hash the token for storage
	tokenHash := hashToken(rawToken)
	expiresAt := time.Now().Add(s.resetTokenExpiry)

	// Store the hashed token
	_, err = s.resetRepo.Create(ctx, user.ID, tokenHash, expiresAt)
	if err != nil {
		return nil //nolint:nilerr // intentional: silent fail to avoid leaking internal errors
	}

	// Send email with the raw token
	if user.Email != nil {
		_ = s.emailService.SendPasswordResetEmail(*user.Email, rawToken)
	}

	return nil
}

// ResetPassword validates the token and sets a new password
func (s *AuthService) ResetPassword(ctx context.Context, rawToken, newPassword string) error {
	if s.resetRepo == nil {
		return ErrResetTokenInvalid
	}

	if len(newPassword) < 8 {
		return ErrPasswordTooShort
	}

	tokenHash := hashToken(rawToken)
	resetToken, err := s.resetRepo.GetByTokenHash(ctx, tokenHash)
	if err != nil {
		return ErrResetTokenInvalid
	}

	// Check if token was already used
	if resetToken.UsedAt != nil {
		return ErrResetTokenUsed
	}

	// Check if token has expired
	if time.Now().After(resetToken.ExpiresAt) {
		return ErrResetTokenExpired
	}

	// Hash new password
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update password
	if err := s.userRepo.UpdatePassword(ctx, resetToken.UserID, string(hash)); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// Mark token as used
	if err := s.resetRepo.MarkUsed(ctx, resetToken.ID); err != nil {
		// Non-critical error, log but don't fail
		slog.Error("failed to mark reset token as used", "token_id", resetToken.ID, "error", err)
	}

	// Delete all reset tokens for this user (invalidate any other pending resets)
	if err := s.resetRepo.DeleteByUserID(ctx, resetToken.UserID); err != nil {
		slog.Error("failed to delete reset tokens after password reset", "user_id", resetToken.UserID, "error", err)
	}

	// Revoke all refresh tokens to force re-login on all devices. A failure here
	// leaves pre-existing sessions alive after a compromise-recovery flow, so log
	// it loudly even though the password change itself already succeeded.
	if err := s.RevokeAllRefreshTokens(ctx, resetToken.UserID); err != nil {
		slog.Error("failed to revoke refresh tokens after password reset", "user_id", resetToken.UserID, "error", err)
	}

	return nil
}

// ChangePassword changes the password for an authenticated user
func (s *AuthService) ChangePassword(ctx context.Context, userID, currentPassword, newPassword string) error {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return err
	}

	// Check if user has a password (OAuth-only users can't change password this way)
	if user.PasswordHash == "" {
		return ErrNoPassword
	}

	// Verify current password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)); err != nil {
		return ErrIncorrectPassword
	}

	if len(newPassword) < 8 {
		return ErrPasswordTooShort
	}

	// Hash new password
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update password
	if err := s.userRepo.UpdatePassword(ctx, userID, string(hash)); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// Invalidate any pending password reset tokens
	if s.resetRepo != nil {
		if err := s.resetRepo.DeleteByUserID(ctx, userID); err != nil {
			slog.Error("failed to delete reset tokens after password change", "user_id", userID, "error", err)
		}
	}

	// Revoke all refresh tokens to force re-login on all devices. A failure here
	// leaves pre-existing sessions alive after a compromise-recovery flow, so log
	// it loudly even though the password change itself already succeeded.
	if err := s.RevokeAllRefreshTokens(ctx, userID); err != nil {
		slog.Error("failed to revoke refresh tokens after password change", "user_id", userID, "error", err)
	}

	return nil
}

// HasPassword returns true if the user has a password set (not OAuth-only)
func (s *AuthService) HasPassword(ctx context.Context, userID string) (bool, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return false, err
	}
	return user.PasswordHash != "", nil
}

// DeleteAccount verifies the user's identity and deletes all associated data.
// For password-based accounts, the password must be provided.
// For OAuth-only accounts, the username must be provided for confirmation.
func (s *AuthService) DeleteAccount(ctx context.Context, userID, password, username string) error {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return err
	}

	// Determine verification method based on account type
	if user.PasswordHash != "" {
		// Password-based account: verify password
		if password == "" {
			return ErrIncorrectPassword
		}
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
			return ErrIncorrectPassword
		}
	} else if username == "" || username != user.Username {
		// OAuth-only account: verify username
		return ErrInvalidCredentials
	}

	// Delete user and all associated data
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
	// replay of this token can be detected as reuse above.
	if err := s.refreshTokenRepo.MarkConsumed(ctx, storedToken.ID); err != nil {
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

// RevokeAllRefreshTokens revokes all refresh tokens for a user (used on password change)
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
