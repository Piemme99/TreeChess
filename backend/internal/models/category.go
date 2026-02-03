package models

import "time"

// Category represents a group of repertoires
type Category struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Color     Color     `json:"color"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// CategoryWithRepertoires includes the category with its repertoires
type CategoryWithRepertoires struct {
	Category
	Repertoires []Repertoire `json:"repertoires"`
}

// CreateCategoryRequest represents a request to create a new category
type CreateCategoryRequest struct {
	Name  string `json:"name"`
	Color Color  `json:"color"`
}

// UpdateCategoryRequest represents a request to update a category (rename)
type UpdateCategoryRequest struct {
	Name string `json:"name"`
}

// AssignCategoryRequest represents a request to assign a repertoire to a category
type AssignCategoryRequest struct {
	CategoryID *string `json:"categoryId"`
}
