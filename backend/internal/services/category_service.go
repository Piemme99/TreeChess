package services

import (
	"errors"
	"fmt"
	"strings"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
)

// Category errors
var (
	ErrCategoryNotFound = fmt.Errorf("category not found")
	ErrCategoryLimit    = fmt.Errorf("maximum category limit reached (50)")
)

const maxCategories = 50

// ExtendedRepertoireRepository includes category-related methods
type ExtendedRepertoireRepository interface {
	repository.RepertoireRepository
	GetByCategory(categoryID string) ([]models.Repertoire, error)
}

// CategoryService handles category business logic
type CategoryService struct {
	repo           repository.CategoryRepository
	repertoireRepo ExtendedRepertoireRepository
}

// NewCategoryService creates a new category service
func NewCategoryService(repo repository.CategoryRepository, repertoireRepo ExtendedRepertoireRepository) *CategoryService {
	return &CategoryService{
		repo:           repo,
		repertoireRepo: repertoireRepo,
	}
}

// CreateCategory creates a new category
func (s *CategoryService) CreateCategory(userID, name string, color models.Color) (*models.Category, error) {
	if color != models.ColorWhite && color != models.ColorBlack {
		return nil, fmt.Errorf("%w: %s", ErrInvalidColor, color)
	}

	name = strings.TrimSpace(name)
	if name == "" {
		return nil, ErrNameRequired
	}
	if len(name) > 100 {
		return nil, ErrNameTooLong
	}

	// Check category limit
	count, err := s.repo.Count(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to check category count: %w", err)
	}
	if count >= maxCategories {
		return nil, ErrCategoryLimit
	}

	return s.repo.Create(userID, name, color)
}

// GetCategory retrieves a category by ID
func (s *CategoryService) GetCategory(id string) (*models.Category, error) {
	cat, err := s.repo.GetByID(id)
	if err != nil {
		if errors.Is(err, repository.ErrCategoryNotFound) {
			return nil, ErrCategoryNotFound
		}
		return nil, err
	}
	return cat, nil
}

// GetCategoryWithRepertoires retrieves a category with its associated repertoires
func (s *CategoryService) GetCategoryWithRepertoires(id string) (*models.CategoryWithRepertoires, error) {
	cat, err := s.repo.GetByID(id)
	if err != nil {
		if errors.Is(err, repository.ErrCategoryNotFound) {
			return nil, ErrCategoryNotFound
		}
		return nil, err
	}

	repertoires, err := s.repertoireRepo.GetByCategory(id)
	if err != nil {
		return nil, fmt.Errorf("failed to get repertoires for category: %w", err)
	}

	return &models.CategoryWithRepertoires{
		Category:    *cat,
		Repertoires: repertoires,
	}, nil
}

// ListCategories returns all categories for a user, optionally filtered by color
func (s *CategoryService) ListCategories(userID string, color *models.Color) ([]models.Category, error) {
	if color != nil {
		if *color != models.ColorWhite && *color != models.ColorBlack {
			return nil, fmt.Errorf("%w: %s", ErrInvalidColor, *color)
		}
		return s.repo.GetByUserAndColor(userID, *color)
	}
	return s.repo.GetAll(userID)
}

// RenameCategory updates the name of a category
func (s *CategoryService) RenameCategory(id, name string) (*models.Category, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, ErrNameRequired
	}
	if len(name) > 100 {
		return nil, ErrNameTooLong
	}

	return s.repo.UpdateName(id, name)
}

// DeleteCategory deletes a category (and cascades to its repertoires)
func (s *CategoryService) DeleteCategory(id string) error {
	err := s.repo.Delete(id)
	if err != nil {
		if errors.Is(err, repository.ErrCategoryNotFound) {
			return ErrCategoryNotFound
		}
		return err
	}
	return nil
}

// CheckOwnership verifies that a category belongs to the given user
func (s *CategoryService) CheckOwnership(id, userID string) error {
	belongs, err := s.repo.BelongsToUser(id, userID)
	if err != nil {
		return fmt.Errorf("failed to check ownership: %w", err)
	}
	if !belongs {
		return ErrCategoryNotFound
	}
	return nil
}

// GetRepertoireCountForCategory returns the number of repertoires in a category
func (s *CategoryService) GetRepertoireCountForCategory(categoryID string) (int, error) {
	repertoires, err := s.repertoireRepo.GetByCategory(categoryID)
	if err != nil {
		return 0, err
	}
	return len(repertoires), nil
}
