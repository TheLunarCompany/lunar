package compression

import (
	"bytes"
	"compress/gzip"
	"io"
)

func DecompressGZip(compressed string) (string, error) {
	reader, err := gzip.NewReader(bytes.NewBuffer([]byte(compressed)))
	if err != nil {
		return "", err
	}
	defer reader.Close()

	bytes, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}

	return string(bytes), nil
}
