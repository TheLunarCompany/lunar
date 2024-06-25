package streamtypes

import (
	"net/url"
	"time"
)

type OnRequest struct {
	ID          string
	SequenceID  string
	Method      string
	Scheme      string
	URL         string
	Path        string
	Query       string
	Headers     map[string]string
	Body        string
	Time        time.Time
	parsedURL   *url.URL
	parsedQuery url.Values
	size        int
}
