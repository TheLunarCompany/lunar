package streamtypes

import (
	"net/url"
	"time"
)

type OnRequest struct {
	id          string
	sequenceID  string
	method      string
	scheme      string
	url         string
	path        string
	query       string
	headers     map[string]string
	body        string
	time        time.Time
	parsedURL   *url.URL
	parsedQuery url.Values
	size        int
}
