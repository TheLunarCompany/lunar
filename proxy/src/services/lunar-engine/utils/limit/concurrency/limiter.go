package concurrency

import (
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/vacuum"
	"sync"
	"time"
)

type Limiter struct {
	slots            map[string]struct{}
	mutex            *sync.RWMutex
	slotsVacuum      vacuum.MapVacuum[string, struct{}]
	concurrencyLimit int
}

func NewLimiter(
	concurrencyLimit int,
	ttl time.Duration,
	vacuumTick time.Duration,
	clock clock.Clock,
) *Limiter {
	slots := map[string]struct{}{}
	mutex := sync.RWMutex{}
	slotsVacuum := vacuum.NewMapVacuum[string, struct{}](
		"ConcurrencyLimiter",
		clock,
		ttl,
		vacuumTick,
		slots,
		&mutex,
	)

	return &Limiter{
		slots:            slots,
		mutex:            &mutex,
		slotsVacuum:      slotsVacuum,
		concurrencyLimit: concurrencyLimit,
	}
}

func (r *Limiter) TryTakeSlot(id string) bool { //nolint: varnamelen
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if len(r.slots) >= r.concurrencyLimit {
		return false
	}

	r.slots[id] = struct{}{}
	r.slotsVacuum.VacuumKey(id)
	return true
}

func (r *Limiter) ReleaseSlot(id string) {
	r.mutex.Lock()
	defer r.mutex.Unlock()
	delete(r.slots, id)
}

func (r *Limiter) ConcurrencyLimit() int {
	return r.concurrencyLimit
}

func (r *Limiter) SetConcurrencyLimit(newLimit int) {
	r.mutex.Lock()
	defer r.mutex.Unlock()
	r.concurrencyLimit = newLimit
}
