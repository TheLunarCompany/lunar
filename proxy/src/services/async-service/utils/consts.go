package utils

import "net/http"

const (
	RunnerName = "AsyncService"
)

var (
	HeaderLunarRequestID = http.CanonicalHeaderKey("x-lunar-sequence-id")
	HeaderLunarScheme    = http.CanonicalHeaderKey("x-lunar-scheme")
	HeaderAsyncRetrieve  = http.CanonicalHeaderKey("x-lunar-async-retrieve")
)
