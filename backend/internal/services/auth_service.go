package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
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
	userRepo          repository.UserRepository
	resetRepo         repository.PasswordResetRepository
	emailService      EmailSender
	jwtSecret         []byte
	jwtExpiry         time.Duration
	resetTokenExpiry  time.Duration
	maxResetPerHour   int
}

func NewAuthService(userRepo repository.UserRepository, jwtSecret string, jwtExpiry time.Duration) *AuthService {
	return &AuthService{
		userRepo:         userRepo,
		jwtSecret:        []byte(jwtSecret),
		jwtExpiry:        jwtExpiry,
		resetTokenExpiry: 1 * time.Hour,
		maxResetPerHour:  3,
	}
}

// WithPasswordReset sets up password reset dependencies
func (s *AuthService) WithPasswordReset(resetRepo repository.PasswordResetRepository, emailService EmailSender, expiryHours int) {
	s.resetRepo = resetRepo
	s.emailService = emailService
	if expiryHours > 0 {
		s.resetTokenExpiry = time.Duration(expiryHours) * time.Hour
	}
}

func (s *AuthService) Register(email, username, password string) (*models.AuthResponse, error) {
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

	user, err := s.userRepo.Create(email, username, string(hash))
	if err != nil {
		return nil, err
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{Token: token, User: *user}, nil
}

func (s *AuthService) Login(email, password string) (*models.AuthResponse, error) {
	user, err := s.userRepo.GetByEmail(email)
	if err != nil {
		if err == repository.ErrUserNotFound {
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

	return &models.AuthResponse{Token: token, User: *user}, nil
}

func (s *AuthService) ValidateToken(tokenStr string) (string, error) {
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

	return sub, nil
}

func (s *AuthService) GetUserByID(id string) (*models.User, error) {
	return s.userRepo.GetByID(id)
}

func (s *AuthService) UpdateProfile(userID string, req models.UpdateProfileRequest) (*models.User, error) {
	return s.userRepo.UpdateProfile(userID, req.LichessUsername, req.ChesscomUsername, req.TimeFormatPrefs)
}

func (s *AuthService) generateToken(user *models.User) (string, error) {
	claims := jwt.MapClaims{
		"sub":      user.ID,
		"username": user.Username,
		"exp":      time.Now().Add(s.jwtExpiry).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

// RequestPasswordReset initiates the password reset flow
// Always returns nil to prevent email enumeration
func (s *AuthService) RequestPasswordReset(email string) error {
	if s.resetRepo == nil || s.emailService == nil {
		return nil // Silent fail if not configured
	}

	user, err := s.userRepo.GetByEmail(email)
	if err != nil {
		// Don't reveal whether the email exists
		return nil
	}

	// Check if user has a password (OAuth-only users can't reset password)
	if user.PasswordHash == "" {
		return nil
	}

	// Rate limiting: max 3 requests per hour
	since := time.Now().Add(-1 * time.Hour)
	count, err := s.resetRepo.CountRecentByUserID(user.ID, since)
	if err != nil {
		return nil // Silent fail
	}
	if count >= s.maxResetPerHour {
		return nil // Silent fail to prevent enumeration
	}

	// Generate secure token
	rawToken, err := generateSecureToken(32)
	if err != nil {
		return nil
	}

	// Hash the token for storage
	tokenHash := hashToken(rawToken)
	expiresAt := time.Now().Add(s.resetTokenExpiry)

	// Store the hashed token
	_, err = s.resetRepo.Create(user.ID, tokenHash, expiresAt)
	if err != nil {
		return nil
	}

	// Send email with the raw token
	if user.Email != nil {
		_ = s.emailService.SendPasswordResetEmail(*user.Email, rawToken)
	}

	return nil
}

// ResetPassword validates the token and sets a new password
func (s *AuthService) ResetPassword(rawToken, newPassword string) error {
	if s.resetRepo == nil {
		return ErrResetTokenInvalid
	}

	if len(newPassword) < 8 {
		return ErrPasswordTooShort
	}

	tokenHash := hashToken(rawToken)
	resetToken, err := s.resetRepo.GetByTokenHash(tokenHash)
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
	if err := s.userRepo.UpdatePassword(resetToken.UserID, string(hash)); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// Mark token as used
	if err := s.resetRepo.MarkUsed(resetToken.ID); err != nil {
		// Non-critical error, log but don't fail
		fmt.Printf("failed to mark reset token as used: %v\n", err)
	}

	// Delete all reset tokens for this user (invalidate any other pending resets)
	_ = s.resetRepo.DeleteByUserID(resetToken.UserID)

	return nil
}

// ChangePassword changes the password for an authenticated user
func (s *AuthService) ChangePassword(userID, currentPassword, newPassword string) error {
	user, err := s.userRepo.GetByID(userID)
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
	if err := s.userRepo.UpdatePassword(userID, string(hash)); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// Invalidate any pending password reset tokens
	if s.resetRepo != nil {
		_ = s.resetRepo.DeleteByUserID(userID)
	}

	return nil
}

// HasPassword returns true if the user has a password set (not OAuth-only)
func (s *AuthService) HasPassword(userID string) (bool, error) {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return false, err
	}
	return user.PasswordHash != "", nil
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
