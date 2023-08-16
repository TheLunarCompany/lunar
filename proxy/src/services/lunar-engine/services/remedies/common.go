package remedies

import (
	"errors"
	"lunar/engine/actions"
)

var ErrMissingConfig = errors.New("missing required remedy config")

func plainTextTooManyRequestsAction(
	statusCode int,
) actions.EarlyResponseAction {
	return actions.EarlyResponseAction{
		Status: statusCode,
		Body:   "Too many requests",
		Headers: map[string]string{
			"Content-Type": "text/plain",
		},
	}
}
