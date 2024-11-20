package urltree_test

import (
	"lunar/toolkit-core/urltree"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTryExtractPathParameterReturnsFalseWhenNoBraces(t *testing.T) {
	t.Parallel()
	_, valid := urltree.TryExtractPathParameter("foo")
	assert.Equal(t, false, valid)
}

func TestTryExtractPathParameterReturnsFalseWhenBraceOnlyOnLeft(t *testing.T) {
	t.Parallel()
	_, valid := urltree.TryExtractPathParameter("{foo")
	assert.Equal(t, false, valid)
}

func TestTryExtractPathParameterReturnsFalseWhenBraceOnlyOnRight(t *testing.T) {
	t.Parallel()
	_, valid := urltree.TryExtractPathParameter("foo}")
	assert.Equal(t, false, valid)
}

func TestTryExtractPathParameterReturnsTrueAndParamNameWhenWrappedInBraces(
	t *testing.T,
) {
	t.Parallel()
	paramName, valid := urltree.TryExtractPathParameter("{foo}")
	assert.Equal(t, true, valid)
	assert.Equal(t, "foo", paramName)
}
