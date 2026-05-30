package repository

import (
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
)

func TestIsDuplicateKeyError(t *testing.T) {
	uniqueViolation := &pgconn.PgError{Code: pgUniqueViolation, ConstraintName: "users_username_key", TableName: "users"}

	tests := []struct {
		name string
		err  error
		want bool
	}{
		{"nil error", nil, false},
		{"plain unique violation", uniqueViolation, true},
		{"wrapped unique violation", fmt.Errorf("create user: %w", uniqueViolation), true},
		{"different pg error code", &pgconn.PgError{Code: "23503"}, false}, // foreign_key_violation
		{"non-pg error", fmt.Errorf("connection refused"), false},
		// Text-matching would falsely flag this; the structured check must not.
		{"plain text mentioning 23505", fmt.Errorf("debug: code 23505 in logs"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, isDuplicateKeyError(tt.err))
		})
	}
}

func TestIsDuplicateEmailError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{"nil error", nil, false},
		{"email constraint", &pgconn.PgError{Code: pgUniqueViolation, ConstraintName: "idx_users_email"}, true},
		{"wrapped email constraint", fmt.Errorf("create user: %w", &pgconn.PgError{Code: pgUniqueViolation, ConstraintName: "idx_users_email"}), true},
		{"username constraint", &pgconn.PgError{Code: pgUniqueViolation, ConstraintName: "users_username_key"}, false},
		{"non-pg error", fmt.Errorf("idx_users_email mentioned in text"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, isDuplicateEmailError(tt.err))
		})
	}
}

func TestIsRepertoireNameConflict(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{"nil error", nil, false},
		{"repertoire unique violation", &pgconn.PgError{Code: pgUniqueViolation, TableName: "repertoires"}, true},
		{"wrapped repertoire unique violation", fmt.Errorf("create repertoire: %w", &pgconn.PgError{Code: pgUniqueViolation, TableName: "repertoires"}), true},
		// A unique violation on another table must not be swallowed as a name conflict.
		{"categories unique violation", &pgconn.PgError{Code: pgUniqueViolation, TableName: "categories"}, false},
		{"non-unique pg error on repertoires", &pgconn.PgError{Code: "23514", TableName: "repertoires"}, false}, // check_violation
		{"non-pg error", fmt.Errorf("repertoires table is busy"), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, isRepertoireNameConflict(tt.err))
		})
	}
}
