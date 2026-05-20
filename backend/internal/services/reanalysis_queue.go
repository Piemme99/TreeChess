package services

import (
	"log/slog"
	"sync"
	"time"
)

// DefaultReanalysisDebounce is the default delay before a queued re-analysis runs.
// A short window coalesces rapid edits (e.g. a user typing several moves in a row)
// into a single run per user.
const DefaultReanalysisDebounce = 3 * time.Second

// ReanalysisNotifier is the interface exposed to mutating services. They only need
// to notify; the queue handles debouncing and execution.
type ReanalysisNotifier interface {
	Notify(userID string)
}

// ReanalysisRunner is invoked when a debounced re-analysis fires for a user.
type ReanalysisRunner func(userID string) error

// ReanalysisStatus describes the queue state for a user. Returned by Status.
type ReanalysisStatus struct {
	InProgress bool `json:"inProgress"`
	Pending    bool `json:"pending"`
}

// ReanalysisQueue triggers a re-analysis after a per-user debounce window.
// Rapid Notify calls collapse into a single run; mutations that arrive while
// a run is in flight cause a single follow-up run after the current one finishes.
//
// State is in-memory only — it does not survive a process restart, which is
// acceptable because re-analysis is a UX improvement, not durable state. Users
// can always re-trigger manually.
type ReanalysisQueue struct {
	run      ReanalysisRunner
	debounce time.Duration

	mu     sync.Mutex
	states map[string]*reanalysisState
}

type reanalysisState struct {
	timer   *time.Timer
	running bool
	redo    bool
}

// NewReanalysisQueue creates a queue that calls run after the given debounce
// delay following a Notify. Concurrent runs for the same user are prevented.
func NewReanalysisQueue(run ReanalysisRunner, debounce time.Duration) *ReanalysisQueue {
	if debounce <= 0 {
		debounce = DefaultReanalysisDebounce
	}
	return &ReanalysisQueue{
		run:      run,
		debounce: debounce,
		states:   make(map[string]*reanalysisState),
	}
}

// Notify schedules a re-analysis for the given user. Calls within the debounce
// window coalesce. If a run is already in flight for the user, the queue
// remembers that a follow-up is needed and triggers it once the current run
// finishes.
func (q *ReanalysisQueue) Notify(userID string) {
	if userID == "" {
		return
	}

	q.mu.Lock()
	defer q.mu.Unlock()

	st, ok := q.states[userID]
	if !ok {
		st = &reanalysisState{}
		q.states[userID] = st
	}

	if st.running {
		// A run is already in flight — capture the new mutation as a redo.
		st.redo = true
		return
	}

	if st.timer != nil {
		st.timer.Stop()
	}
	st.timer = time.AfterFunc(q.debounce, func() {
		q.startRun(userID)
	})
}

// Status returns whether a run is currently executing or pending for the user.
func (q *ReanalysisQueue) Status(userID string) ReanalysisStatus {
	q.mu.Lock()
	defer q.mu.Unlock()

	st, ok := q.states[userID]
	if !ok {
		return ReanalysisStatus{}
	}
	return ReanalysisStatus{
		InProgress: st.running,
		Pending:    st.timer != nil || st.redo,
	}
}

func (q *ReanalysisQueue) startRun(userID string) {
	q.mu.Lock()
	st, ok := q.states[userID]
	if !ok {
		q.mu.Unlock()
		return
	}
	st.timer = nil
	if st.running {
		// Race-defensive: a Notify could have set a new timer that fired before
		// the prior run released the running flag. Capture as redo.
		st.redo = true
		q.mu.Unlock()
		return
	}
	st.running = true
	q.mu.Unlock()

	q.runLoop(userID)
}

func (q *ReanalysisQueue) runLoop(userID string) {
	for {
		if err := q.run(userID); err != nil {
			slog.Error("auto-reanalysis failed", "component", "reanalysis-queue", "user_id", userID, "error", err)
		}

		q.mu.Lock()
		st, ok := q.states[userID]
		if !ok {
			q.mu.Unlock()
			return
		}
		if !st.redo {
			st.running = false
			if st.timer == nil {
				delete(q.states, userID)
			}
			q.mu.Unlock()
			return
		}
		st.redo = false
		q.mu.Unlock()
	}
}

// WaitIdle blocks until no run or pending timer exists for userID, or the timeout
// elapses. It exists for tests; production code should rely on Status polling.
func (q *ReanalysisQueue) WaitIdle(userID string, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for {
		if s := q.Status(userID); !s.InProgress && !s.Pending {
			return true
		}
		if time.Now().After(deadline) {
			return false
		}
		time.Sleep(5 * time.Millisecond)
	}
}
