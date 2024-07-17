package streamtypes

import "time"

type OnResponse struct {
	id         string
	sequenceID string
	method     string
	url        string
	status     int
	size       int
	headers    map[string]string
	body       string
	time       time.Time
}
