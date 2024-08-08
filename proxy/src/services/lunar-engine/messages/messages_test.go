package messages_test

import (
	"lunar/engine/messages"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestItReturnsParsedURL(t *testing.T) {
	onRequest := messages.OnRequest{
		ID:         "123",
		SequenceID: "abc",
		Method:     "GET",
		Scheme:     "http",
		URL:        "www.twitter.com",
		Path:       "/users/2",
		Query:      "flag=true",
		Headers:    map[string]string{"Authorization": "bla"},
		Body:       "{}",
		Time:       time.Now(),
	}

	res, err := onRequest.ParsedURL()
	assert.Nil(t, err)
	assert.Equal(t, "www.twitter.com", res.Host)
	assert.Equal(t, "http", res.Scheme)
	assert.Equal(
		t,
		url.Values(map[string][]string{"flag": {"true"}}),
		res.Query(),
	)
}

func TestItReturnsUpdatedParsedURLWhenHostChanged(t *testing.T) {
	onRequest := messages.OnRequest{
		ID:         "123",
		SequenceID: "abc",
		Method:     "GET",
		Scheme:     "http",
		URL:        "www.twitter.com",
		Path:       "/users/2",
		Query:      "flag=true",
		Headers:    map[string]string{"Authorization": "bla"},
		Body:       "{}",
		Time:       time.Now(),
	}

	res, err := onRequest.ParsedURL()
	assert.Nil(t, err)
	assert.Equal(t, "www.twitter.com", res.Host)

	onRequest.URL = "www.medium.com"
	res, err = onRequest.ParsedURL()
	assert.Nil(t, err)
	assert.Equal(t, "www.medium.com", res.Host)
}

func TestItReturnsUpdatedParsedURLWhenSchemeChanged(t *testing.T) {
	onRequest := messages.OnRequest{
		ID:         "123",
		SequenceID: "abc",
		Method:     "GET",
		Scheme:     "http",
		URL:        "www.twitter.com",
		Path:       "/users/2",
		Query:      "flag=true",
		Headers:    map[string]string{"Authorization": "bla"},
		Body:       "{}",
		Time:       time.Now(),
	}

	res, err := onRequest.ParsedURL()
	assert.Nil(t, err)
	assert.Equal(t, "http", res.Scheme)

	onRequest.Scheme = "https"
	res, err = onRequest.ParsedURL()
	assert.Nil(t, err)
	assert.Equal(t, "https", res.Scheme)
}

func TestItReturnsUpdatedParsedURLWhenQueryChanged(t *testing.T) {
	onRequest := messages.OnRequest{
		ID:         "123",
		SequenceID: "abc",
		Method:     "GET",
		Scheme:     "http",
		URL:        "www.twitter.com",
		Path:       "/users/2",
		Query:      "flag=true",
		Headers:    map[string]string{"Authorization": "bla"},
		Body:       "{}",
		Time:       time.Now(),
	}

	res, err := onRequest.ParsedURL()
	assert.Nil(t, err)
	assert.Equal(
		t,
		url.Values(map[string][]string{"flag": {"true"}}),
		res.Query(),
	)

	onRequest.Query = ""
	res, err = onRequest.ParsedURL()
	assert.Nil(t, err)
	assert.Equal(t, url.Values(map[string][]string{}), res.Query())
}
