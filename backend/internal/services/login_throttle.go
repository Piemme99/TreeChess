package services

import (
	"sync"
	"time"
)

// loginThrottle limits password guesses per account, whatever the source IP.
// After maxAttempts attempts without a success inside window, the account
// refuses every login for lockFor. State is in memory: the backend runs as a
// single replica, and the map holds at most one entry per existing account.
type loginThrottle struct {
	mu          sync.Mutex
	now         func() time.Time
	maxAttempts int
	window      time.Duration
	lockFor     time.Duration
	accounts    map[string]*loginAttempts
}

type loginAttempts struct {
	count       int
	firstAt     time.Time
	lockedUntil time.Time
}

func newLoginThrottle(maxAttempts int, window, lockFor time.Duration, now func() time.Time) *loginThrottle {
	return &loginThrottle{
		now:         now,
		maxAttempts: maxAttempts,
		window:      window,
		lockFor:     lockFor,
		accounts:    make(map[string]*loginAttempts),
	}
}

// attempt reserves one login attempt for the account. allowed is false while
// the account is locked. lastBeforeLock is true when this attempt locks the
// account unless it succeeds.
//
// The attempt is counted before the password is checked, so concurrent
// guesses cannot all slip under the threshold; succeeded clears it.
func (t *loginThrottle) attempt(account string) (allowed, lastBeforeLock bool) {
	t.mu.Lock()
	defer t.mu.Unlock()

	now := t.now()
	a := t.accounts[account]
	if a != nil {
		if now.Before(a.lockedUntil) {
			return false, false
		}
		if !a.lockedUntil.IsZero() || now.Sub(a.firstAt) >= t.window {
			a = nil
		}
	}
	if a == nil {
		a = &loginAttempts{firstAt: now}
		t.accounts[account] = a
	}

	a.count++
	if a.count >= t.maxAttempts {
		a.lockedUntil = now.Add(t.lockFor)
		return true, true
	}
	return true, false
}

// succeeded forgets the account's attempts, including a lock taken by the
// attempt that just succeeded.
func (t *loginThrottle) succeeded(account string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.accounts, account)
}
