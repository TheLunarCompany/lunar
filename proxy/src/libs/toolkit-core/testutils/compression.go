package testutils

import (
	"bytes"
	"compress/gzip"
)

// The following is an unsafe implementation, to be used only in tests.
func CompressGZip(input string) string {
	var b bytes.Buffer
	gz := gzip.NewWriter(&b)
	_, _ = gz.Write([]byte(input))
	gz.Close()
	return b.String()
}
