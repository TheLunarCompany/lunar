package streamtypes

import (
	"bytes"
	"compress/gzip"
	"compress/zlib"
	"fmt"
	"io"
)

func DecodeBody(rawBody []byte, contentEncoding string) (string, error) {
	if len(rawBody) == 0 {
		return "", nil
	}

	var reader io.Reader = bytes.NewReader(rawBody)

	switch contentEncoding {
	case "gzip":
		var err error
		reader, err = gzip.NewReader(reader)
		if err != nil {
			return "", fmt.Errorf("failed to decode gzip: %w", err)
		}
		defer reader.(io.Closer).Close()
	case "deflate":
		var err error
		reader, err = zlib.NewReader(reader)
		if err != nil {
			return "", fmt.Errorf("failed to decode deflate: %w", err)
		}
		defer reader.(io.Closer).Close()
	}

	decodedBytes, err := io.ReadAll(reader)
	if err != nil {
		return "", fmt.Errorf("error reading decoding reader")
	}
	return string(decodedBytes), nil
}
