//go:build !pro

package quotaresource

import (
	"time"

	"github.com/redis/go-redis/v9"
)

type memorySetup struct {
	client  *redis.Client //nolint:unused
	cleanup func()
	setTime func(time.Time)
}

func setupMemory() (memorySetup, error) {
	return memorySetup{cleanup: func() {}, setTime: func(time.Time) {}}, nil
}
