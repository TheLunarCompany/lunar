package streamtypes

import (
	"net/url"
	"time"
)

type OnRequest struct {
	ID          string            `json:"id"`
	SequenceID  string            `json:"sequence_id"`
	Method      string            `json:"method"`
	Scheme      string            `json:"scheme"`
	URL         string            `json:"url"`
	Path        string            `json:"path"`
	Query       string            `json:"query"`
	Headers     map[string]string `json:"headers"`
	Body        string            `json:"body"`
	Time        time.Time         `json:"time"`
	ParsedURL   *url.URL          `json:"parsed_url"`
	ParsedQuery url.Values        `json:"parsed_query"`
	Size        int               `json:"size"`
}
