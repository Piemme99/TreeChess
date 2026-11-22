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
