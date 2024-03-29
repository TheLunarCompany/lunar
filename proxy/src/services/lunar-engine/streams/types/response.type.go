package streamtypes

import "time"

type OnResponse struct {
	ID         string
	SequenceID string
	Method     string
	URL        string
	Status     int
	size       int
	Headers    map[string]string
	Body       string
	Time       time.Time
}
