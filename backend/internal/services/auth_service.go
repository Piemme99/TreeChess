package services

import (
	"fmt"
	"regexp"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
)

var usernamePattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{3,50}$`)

var (
	ErrInvalidUsername    = fmt.Errorf("username must be 3-50 alphanumeric characters, hyphens or underscores")
	ErrPasswordTooShort  = fmt.Errorf("password must be at least 8 characters")
	ErrInvalidCredentials = fmt.Errorf("invalid credentials")
	ErrUnauthorized       = fmt.Errorf("unauthorized")
	ErrOAuthOnly          = fmt.Errorf("this account uses Lichess login")
)

type AuthService struct {
	userRepo  repository.UserRepository
	jwtSecret []byte
	jwtExpiry time.Duration
}

func NewAuthService(userRepo repository.UserRepository, jwtSecret string, jwtExpiry time.Duration) *AuthService {
	return &AuthService{
		userRepo:  userRepo,
		jwtSecret: []byte(jwtSecret),
		jwtExpiry: jwtExpiry,
	}
}

func (s *AuthService) Register(username, password string) (*models.AuthResponse, error) {
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

	user, err := s.userRepo.Create(username, string(hash))
	if err != nil {
		return nil, err
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	return &models.AuthResponse{Token: token, User: *user}, nil
}

func (s *AuthService) Login(username, password string) (*models.AuthResponse, error) {
	user, err := s.userRepo.GetByUsername(username)
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
