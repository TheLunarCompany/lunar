package streamtypes

import "time"

type OnResponse struct {
	ID         string            `json:"id"`
	SequenceID string            `json:"sequence_id"`
	Method     string            `json:"method"`
	URL        string            `json:"url"`
	Status     int               `json:"status"`
	Size       int               `json:"size"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	BodyMap    map[string]any    `json:"body_map"`
	Time       time.Time         `json:"time"`
}
