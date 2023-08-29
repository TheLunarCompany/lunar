package actions

import (
	"time"
)

const (
	layout = "2006-01-02T15:04:05Z"
)

func TimestampToStringFromInt64(timestamp int64) string {
	// Convert the timestamp to time.Time
	time := time.Unix(0, timestamp*int64(time.Millisecond)).UTC()

	// Convert the time to a formatted string
	return time.Format(layout)
}
