package clock

import (
	"sync"
	"time"
)

type MockClock struct {
	currentTime time.Time
	wakeup      chan bool
	mutex       sync.RWMutex
}
