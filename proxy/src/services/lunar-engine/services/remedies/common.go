package remedies

import (
	"errors"
	"lunar/engine/actions"
	"time"
)

var ErrMissingConfig = errors.New("missing required remedy config")

func plainTextTooManyRequestsAction(
	statusCode int,
) actions.EarlyResponseAction {
	return actions.EarlyResponseAction{
		Status: statusCode,
		Body:   "Too many requests",
		Headers: map[string]string{
			"content-type": "text/plain",
		},
	}
}

type CachedResponse struct {
	ID           string
	Body         string
	Headers      map[string]string
	Status       int
	CreationTime time.Time
}
