package streamtypes

import (
	"strconv"
)

func (res *OnResponse) IsNewSequence() bool {
	return res.ID == res.SequenceID
}

func (res *OnResponse) DoesHeaderExist(headerName string) bool {
	_, found := res.Headers[headerName]
	return found
}

func (res *OnResponse) DoesHeaderValueMatch(headerName, headerValue string) bool {
	if !res.DoesHeaderExist(headerName) {
		return false
	}
	return res.Headers[headerName] == headerValue
}

func (res *OnResponse) Size() int {
	if res.size > 0 {
		return res.size
	}

	if sizeStr, ok := res.Headers["Content-Length"]; ok {
		size, _ := strconv.Atoi(sizeStr)
		res.size = size
		return res.size
	}

	if res.Body != "" {
		res.size = len(res.Body)
		return len(res.Body)
	}
	return res.size
}
