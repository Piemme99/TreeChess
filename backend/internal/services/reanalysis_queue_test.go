package services

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReanalysisQueue_DebouncesRapidNotifications(t *testing.T) {
	var calls atomic.Int32
	q := NewReanalysisQueue(func(userID string) error {
		calls.Add(1)
		return nil
	}, 30*time.Millisecond)

	// Five rapid Notify calls within the debounce window should collapse into one run.
	for i := 0; i < 5; i++ {
		q.Notify("u1")
		time.Sleep(5 * time.Millisecond)
	}

	require.True(t, q.WaitIdle("u1", time.Second))
	assert.Equal(t, int32(1), calls.Load(), "rapid notifications should coalesce into a single run")
}

func TestReanalysisQueue_ReportsPendingAndInProgress(t *testing.T) {
	released := make(chan struct{})
	started := make(chan struct{})
	q := NewReanalysisQueue(func(userID string) error {
		close(started)
		<-released
		return nil
	}, 10*time.Millisecond)

	q.Notify("u1")

	// While the timer is pending, Status.Pending=true, InProgress=false.
	assert.Eventually(t, func() bool {
		s := q.Status("u1")
		return s.Pending && !s.InProgress
	}, 200*time.Millisecond, 5*time.Millisecond, "expected pending state before run starts")

	<-started
	// Run is now executing — InProgress=true.
	s := q.Status("u1")
	assert.True(t, s.InProgress, "expected InProgress while runner executes")

	close(released)
	require.True(t, q.WaitIdle("u1", time.Second))

	final := q.Status("u1")
	assert.False(t, final.InProgress)
	assert.False(t, final.Pending)
}

func TestReanalysisQueue_NotifyDuringRunTriggersFollowUp(t *testing.T) {
	var calls atomic.Int32
	releaseFirst := make(chan struct{})
	firstStarted := make(chan struct{})

	q := NewReanalysisQueue(func(userID string) error {
		n := calls.Add(1)
		if n == 1 {
			close(firstStarted)
			<-releaseFirst
		}
		return nil
	}, 10*time.Millisecond)

	q.Notify("u1")
	<-firstStarted

	// Notify while the first run is in flight; this should be coalesced into one follow-up run.
	q.Notify("u1")
	q.Notify("u1")
	q.Notify("u1")

	// Status should report InProgress=true and Pending=true (a follow-up is queued).
	s := q.Status("u1")
	assert.True(t, s.InProgress)
	assert.True(t, s.Pending, "expected pending follow-up after Notify during run")

	close(releaseFirst)
	require.True(t, q.WaitIdle("u1", time.Second))
	assert.Equal(t, int32(2), calls.Load(), "expected one follow-up run after notifications during in-flight run")
}

func TestReanalysisQueue_IsolatesUsers(t *testing.T) {
	var calls sync.Map
	q := NewReanalysisQueue(func(userID string) error {
		v, _ := calls.LoadOrStore(userID, new(atomic.Int32))
		v.(*atomic.Int32).Add(1)
		return nil
	}, 20*time.Millisecond)

	q.Notify("u1")
	q.Notify("u2")
	q.Notify("u1") // still within debounce

	require.True(t, q.WaitIdle("u1", time.Second))
	require.True(t, q.WaitIdle("u2", time.Second))

	v1, _ := calls.Load("u1")
	v2, _ := calls.Load("u2")
	assert.Equal(t, int32(1), v1.(*atomic.Int32).Load())
	assert.Equal(t, int32(1), v2.(*atomic.Int32).Load())
}

func TestReanalysisQueue_RunnerErrorDoesNotBlockSubsequentRuns(t *testing.T) {
	var calls atomic.Int32
	q := NewReanalysisQueue(func(userID string) error {
		calls.Add(1)
		return errors.New("boom")
	}, 10*time.Millisecond)

	q.Notify("u1")
	require.True(t, q.WaitIdle("u1", time.Second))

	q.Notify("u1")
	require.True(t, q.WaitIdle("u1", time.Second))

	assert.Equal(t, int32(2), calls.Load(), "errors should not prevent future runs")
}

func TestReanalysisQueue_EmptyUserIDIsIgnored(t *testing.T) {
	var calls atomic.Int32
	q := NewReanalysisQueue(func(userID string) error {
		calls.Add(1)
		return nil
	}, 10*time.Millisecond)

	q.Notify("")
	time.Sleep(30 * time.Millisecond)
	assert.Equal(t, int32(0), calls.Load(), "empty userID should not schedule a run")
}
