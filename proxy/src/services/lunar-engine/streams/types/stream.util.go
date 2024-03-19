package streamtypes

import (
	"fmt"
	"net/url"
)

func (req *OnRequest) ParsedURL() (*url.URL, error) {
	currentURLParts := parsedURLParts{
		scheme: req.Scheme,
		url:    req.URL,
		query:  req.Query,
	}
	if req.parsedURL == nil ||
		currentURLParts != req.parsedURLParts {
		urlWithQueryString := fmt.Sprintf(
			"%s://%s?%s",
			req.Scheme,
			req.URL,
			req.Query,
		)
		parsedURL, err := url.Parse(urlWithQueryString)
		if err != nil {
			return nil, err
		}
		req.parsedURL = parsedURL
		req.parsedURLParts = currentURLParts
	}

	return req.parsedURL, nil
}

func (res *OnResponse) IsNewSequence() bool {
	return res.ID == res.SequenceID
}

func (res *OnResponse) JSON() (map[string]interface{}, error) {
	return nil, fmt.Errorf("JSON method not implemented")
}

func (res *OnResponse) XML() (string, error) {
	return "", fmt.Errorf("XML method not implemented")
}

func (res *OnResponse) Size() (int, error) {
	return 0, fmt.Errorf("Size method not implemented")
}

func (req *OnRequest) JSON() (map[string]interface{}, error) {
	return nil, fmt.Errorf("JSON method not implemented")
}

func (req *OnRequest) XML() (string, error) {
	return "", fmt.Errorf("XML method not implemented")
}

func (req *OnRequest) Size() (int, error) {
	return 0, fmt.Errorf("Size method not implemented")
}
