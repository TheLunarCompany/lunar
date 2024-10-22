//go:build pro

package streamtypes

import (
	publictypes "lunar/engine/streams/public-types"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestContextForPrimitive(
	t *testing.T,
	contextA publictypes.SharedStateI[string],
	contextB publictypes.SharedStateI[string],
) {
	err := contextA.Set("key1", "value1")
	require.NoError(t, err)

	err = contextA.Set("key2", "value2")
	require.NoError(t, err)

	actualValStr, err := contextB.Get("key1")
	require.NoError(t, err)
	require.Equal(t, "value1", actualValStr)

	actualValStr, err = contextB.Get("key2")
	require.NoError(t, err)
	require.Equal(t, "value2", actualValStr)

	// test IsExists
	require.True(t, contextA.Exists("key2"))
	require.True(t, contextB.Exists("key2"))

	// test update value
	err = contextA.Set("key2", "new_value")
	require.NoError(t, err)

	actualValStr, err = contextB.Get("key2")
	require.NoError(t, err)
	require.Equal(t, "new_value", actualValStr)

	// test pop
	actualValStr, err = contextB.Pop("key1")
	require.NoError(t, err)
	require.Equal(t, "value1", actualValStr)

	_, err = contextA.Get("key1")
	require.Error(t, err)
}

func TestContextForSlice(
	t *testing.T,
	contextSliceA publictypes.SharedStateI[[]float64],
	contextSliceB publictypes.SharedStateI[[]float64],
) {
	err := contextSliceA.Set("key4", []float64{1.1, 2.2, 3.3})
	require.NoError(t, err)

	err = contextSliceA.Set("key5", []float64{4.4, 5.5, 6.6})
	require.NoError(t, err)

	actualSlice, err := contextSliceB.Get("key4")
	require.NoError(t, err)
	require.Equal(t, []float64{1.1, 2.2, 3.3}, actualSlice)

	actualSlice, err = contextSliceB.Get("key5")
	require.NoError(t, err)
	require.Equal(t, []float64{4.4, 5.5, 6.6}, actualSlice)
}

func TestContextWithScore(
	t *testing.T,
	contextKey string,
	contextA publictypes.SharedStateI[string],
	contextB publictypes.SharedStateI[string],
) {
	err := contextA.SetWithScore(contextKey, 2.0, "value1")
	require.NoError(t, err)

	err = contextA.SetWithScore(contextKey, 1.0, "value2")
	require.NoError(t, err)

	err = contextA.SetWithScore(contextKey, 3.0, "value3")
	require.NoError(t, err)

	actualVal, err := contextB.Get(contextKey)
	require.NoError(t, err)
	require.Equal(t, "value2", actualVal)

	expectedSlice, err := contextB.GetMany(contextKey, -1)
	require.NoError(t, err)
	require.Equal(t, []string{"value2", "value1", "value3"}, expectedSlice)

	// testing pop by score
	actualVal, err = contextA.Pop(contextKey)
	require.NoError(t, err)
	require.Equal(t, "value2", actualVal)

	actualVal, err = contextA.Pop(contextKey)
	require.NoError(t, err)
	require.Equal(t, "value1", actualVal)

	actualVal, err = contextA.Pop(contextKey)
	require.NoError(t, err)
	require.Equal(t, "value3", actualVal)

	// testing isExists
	require.False(t, contextB.Exists(contextKey))
}
