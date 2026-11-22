package config

import "time"

// Database timeouts
const (
	DefaultDBTimeout   = 5 * time.Second
	MigrationDBTimeout = 30 * time.Second

	// UserDeleteDBTimeout bounds account deletion, which cascades to every
	// table holding the user's data and so needs more headroom than a single
	// DefaultDBTimeout query.
	UserDeleteDBTimeout = 10 * time.Second
)

// SMTP timeouts: the password-reset email is sent inside the request, so a
// wedged relay must not hold the handler goroutine.
const (
	SMTPDialTimeout = 10 * time.Second
	SMTPSendTimeout = 30 * time.Second
)
