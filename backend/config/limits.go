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
