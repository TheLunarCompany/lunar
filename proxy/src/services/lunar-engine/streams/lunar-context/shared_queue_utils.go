package lunarcontext

import (
	"time"
)

const (
	timeDeltaForDeadRequestDecision = 10 * time.Millisecond
	queueKeySuffix                  = "_queue"
	memberDelimiter                 = "::"
	validMemberKeyParts             = 4
)

func calculateScore(priority float64) float64 {
	// This is a placeholder function that we could use
	// to calculate the score for starvation prevention.
	return priority
}
