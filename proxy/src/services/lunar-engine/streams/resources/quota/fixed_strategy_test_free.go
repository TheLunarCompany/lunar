//go:build !pro

package quotaresource

import (
	"github.com/redis/go-redis/v9"
)

func setupMemory() (*redis.Client, func(), error) {
	return nil, nil, nil
}
