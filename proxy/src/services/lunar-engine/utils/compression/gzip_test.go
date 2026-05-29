package compression_test

import (
	"lunar/engine/utils/compression"
	"lunar/toolkit-core/testutils"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDecompressGZip(t *testing.T) {
	t.Parallel()
	originalInput := "hello, world"
	compressed := testutils.CompressGZip(originalInput)
	assert.NotEqual(t, compressed, originalInput)
	decompressed, err := compression.DecompressGZip(compressed)
	assert.Nil(t, err)
	assert.Equal(t, decompressed, originalInput)
}
