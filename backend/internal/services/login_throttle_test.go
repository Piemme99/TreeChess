package services

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

type fakeClock struct{ t time.Time }

func (c *fakeClock) now() time.Time          { return c.t }
func (c *fakeClock) advance(d time.Duration) { c.t = c.t.Add(d) }

func newTestThrottle(clock *fakeClock) *loginThrottle {
	return newLoginThrottle(3, 15*time.Minute, 10*time.Minute, clock.now)
}

func attempts(t *loginThrottle, account string, n int) {
	for range n {
		t.attempt(account)
	}
}

func TestLoginThrottle_Attempt_LocksAccountAfterThreshold(t *testing.T) {
	clock := &fakeClock{t: time.Unix(0, 0)}
	throttle := newTestThrottle(clock)

	attempts(throttle, "alice", 2)
	allowed, last := throttle.attempt("alice")
	assert.True(t, allowed)
	assert.True(t, last, "the third attempt locks the account if it fails")

	allowed, _ = throttle.attempt("alice")
	assert.False(t, allowed)

	allowed, _ = throttle.attempt("bob")
	assert.True(t, allowed, "another account is not affected")
}

func TestLoginThrottle_Succeeded_ResetsCount(t *testing.T) {
	clock := &fakeClock{t: time.Unix(0, 0)}
	throttle := newTestThrottle(clock)

	attempts(throttle, "alice", 2)
	throttle.succeeded("alice")

	attempts(throttle, "alice", 2)
	allowed, last := throttle.attempt("alice")
	assert.True(t, allowed)
	assert.True(t, last)
}

func TestLoginThrottle_Succeeded_LiftsLockTakenByLastAttempt(t *testing.T) {
	clock := &fakeClock{t: time.Unix(0, 0)}
	throttle := newTestThrottle(clock)

	attempts(throttle, "alice", 3)
	throttle.succeeded("alice")

	allowed, _ := throttle.attempt("alice")
	assert.True(t, allowed)
}

func TestLoginThrottle_Attempt_LockExpires(t *testing.T) {
	clock := &fakeClock{t: time.Unix(0, 0)}
	throttle := newTestThrottle(clock)
	attempts(throttle, "alice", 3)

	clock.advance(10*time.Minute - time.Second)
	allowed, _ := throttle.attempt("alice")
	assert.False(t, allowed, "still locked just before the lock ends")

	clock.advance(time.Second)
	allowed, last := throttle.attempt("alice")
	assert.True(t, allowed)
	assert.False(t, last, "the count starts over after the lock")
}

func TestLoginThrottle_Attempt_OldAttemptsLeaveTheWindow(t *testing.T) {
	clock := &fakeClock{t: time.Unix(0, 0)}
	throttle := newTestThrottle(clock)
	attempts(throttle, "alice", 2)

	clock.advance(15 * time.Minute)
	attempts(throttle, "alice", 2)
	allowed, _ := throttle.attempt("alice")
	assert.True(t, allowed)
}
