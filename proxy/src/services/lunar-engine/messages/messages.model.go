package lunarmessages

import (
	"fmt"
	"net/url"
	"time"
)

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
	RawBody        []byte
	Time           time.Time
	parsedURL      *url.URL
	parsedURLParts parsedURLParts
}

type parsedURLParts struct {
	scheme string
	url    string
	query  string
}

func (onRequest *OnRequest) ParsedURL() (*url.URL, error) {
	currentURLParts := parsedURLParts{
		scheme: onRequest.Scheme,
		url:    onRequest.URL,
		query:  onRequest.Query,
	}
	if onRequest.parsedURL == nil ||
		currentURLParts != onRequest.parsedURLParts {
		urlWithQueryString := fmt.Sprintf(
			"%s://%s?%s",
			onRequest.Scheme,
			onRequest.URL,
			onRequest.Query,
		)
		parsedURL, err := url.Parse(urlWithQueryString)
		if err != nil {
			return nil, err
		}
		onRequest.parsedURL = parsedURL
		onRequest.parsedURLParts = currentURLParts
	}

	return onRequest.parsedURL, nil
}

type OnResponse struct {
	ID         string
	SequenceID string
	Method     string
	URL        string
	Status     int
	Headers    map[string]string
	Body       string
	RawBody    []byte
	Time       time.Time
}

func (onResponse *OnResponse) IsNewSequence() bool {
	return onResponse.ID == onResponse.SequenceID
}
