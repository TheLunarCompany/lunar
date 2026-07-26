package streamconfig

func DoesHeaderExist(headers map[string]string, headerName string) bool {
	_, found := headers[headerName]
	return found
}

func DoesHeaderValueMatch(headers map[string]string, headerName, headerValue string) bool {
	if !DoesHeaderExist(headers, headerName) {
		return false
	}
	return headers[headerName] == headerValue
}
