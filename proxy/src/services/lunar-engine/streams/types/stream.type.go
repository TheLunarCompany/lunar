package streamtypes

import (
	"net/url"
	"time"
)

type APIStream struct {
	Name     string
	Type     StreamType
	Request  *OnRequest
	Response *OnResponse
}

type OnResponse struct {
	ID         string
	SequenceID string
	Method     string
	URL        string
	Status     int
	Headers    map[string]string
	Body       string
	Time       time.Time
}

type OnRequest struct {
	ID             string
	SequenceID     string
	Method         string
	Scheme         string
	URL            string
	Path           string
	Query          string
	Headers        map[string]string
	Body           string
	Time           time.Time
	parsedURL      *url.URL
	parsedURLParts parsedURLParts
}

type parsedURLParts struct {
	scheme string
	url    string
	query  string
}

type StreamType int

const (
	StreamTypeMirror StreamType = iota
	StreamTypeResponse
	StreamTypeRequest
	StreamTypeAny
)
