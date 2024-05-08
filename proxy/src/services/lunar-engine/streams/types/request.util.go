package streamtypes

import (
	"fmt"
	"net/url"
	"strconv"
)

func (req *OnRequest) init() error {
	if req.parsedURL != nil {
		return nil
	}

	if sizeStr, ok := req.Headers["Content-Length"]; ok {
		size, _ := strconv.Atoi(sizeStr)
		req.size = size
	} else {
		req.size = len(req.Body)
	}

	urlWithQueryString := fmt.Sprintf(
		"%s://%s?%s",
		req.Scheme,
		req.URL,
		req.Query,
	)
	parsedURL, err := url.Parse(urlWithQueryString)
	if err != nil {
		return err
	}
	req.parsedURL = parsedURL
	req.parsedQuery = parsedURL.Query()

	return nil
}

func (req *OnRequest) DoesHeaderExist(headerName string) bool {
	_, found := req.Headers[headerName]
	return found
}

func (req *OnRequest) DoesHeaderValueMatch(headerName, headerValue string) bool {
	if !req.DoesHeaderExist(headerName) {
		return false
	}
	return req.Headers[headerName] == headerValue
}

func (req *OnRequest) DoesQueryParamExist(paramName string) (bool, error) {
	if err := req.init(); err != nil {
		return false, err
	}
	_, found := req.parsedURL.Query()[paramName]
	return found, nil
}

func (req *OnRequest) DoesQueryParamValueMatch(paramName, paramValue string) (bool, error) {
	queryExists, err := req.DoesQueryParamExist(paramName)
	if !queryExists {
		return queryExists, err
	}

	return req.parsedURL.Query().Get(paramName) == paramValue, nil
}

func (req *OnRequest) Size() (int, error) {
	if err := req.init(); err != nil {
		return -1, err
	}
	return req.size, nil
}
