package utils

import (
	streamtypes "lunar/engine/streams/types"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExtractNumericParam(t *testing.T) {
	makeProcessorParam := func(value string) streamtypes.ProcessorParam {
		return streamtypes.ProcessorParam{
			Value: value,
		}
	}

	t.Run("valid int parameter", func(t *testing.T) {
		metaData := map[string]streamtypes.ProcessorParam{
			"param1": makeProcessorParam("42"),
		}
		var result int
		err := ExtractNumericParam(metaData, "param1", &result)
		require.NoError(t, err)
		require.Equal(t, 42, result)
	})

	t.Run("valid float64 parameter", func(t *testing.T) {
		metaData := map[string]streamtypes.ProcessorParam{
			"param2": makeProcessorParam("3.14"),
		}
		var result float64
		err := ExtractNumericParam(metaData, "param2", &result)
		require.NoError(t, err)
		require.Equal(t, 3.14, result)
	})

	t.Run("parameter not found", func(t *testing.T) {
		metaData := map[string]streamtypes.ProcessorParam{
			"param1": makeProcessorParam("42"),
		}
		var result int
		err := ExtractNumericParam(metaData, "param3", &result)
		require.Error(t, err)
		require.EqualError(t, err, "parameter param3 not found")
	})

	t.Run("metadata is nil", func(t *testing.T) {
		var result int
		err := ExtractNumericParam[int](nil, "param1", &result)
		require.Error(t, err)
		require.EqualError(t, err, "metadata is nil")
	})

	t.Run("result is nil", func(t *testing.T) {
		metaData := map[string]streamtypes.ProcessorParam{
			"param1": makeProcessorParam("42"),
		}
		err := ExtractNumericParam(metaData, "param1", (*int)(nil))
		require.Error(t, err)
		require.EqualError(t, err, "result is nil")
	})

	t.Run("invalid int parameter", func(t *testing.T) {
		metaData := map[string]streamtypes.ProcessorParam{
			"param1": makeProcessorParam("invalid"),
		}
		var result int
		err := ExtractNumericParam(metaData, "param1", &result)
		require.Error(t, err)
		require.Contains(t, err.Error(), "failed to convert parameter param1 to numeric")
	})

	t.Run("valid uint parameter", func(t *testing.T) {
		metaData := map[string]streamtypes.ProcessorParam{
			"param1": makeProcessorParam("42"),
		}
		var result uint
		err := ExtractNumericParam(metaData, "param1", &result)
		require.NoError(t, err)
		require.Equal(t, uint(42), result)
	})

	t.Run("valid int8 parameter", func(t *testing.T) {
		metaData := map[string]streamtypes.ProcessorParam{
			"param1": makeProcessorParam("127"),
		}
		var result int8
		err := ExtractNumericParam(metaData, "param1", &result)
		require.NoError(t, err)
		require.Equal(t, int8(127), result)
	})

	t.Run("valid float32 parameter", func(t *testing.T) {
		metaData := map[string]streamtypes.ProcessorParam{
			"param2": makeProcessorParam("3.14"),
		}
		var result float32
		err := ExtractNumericParam(metaData, "param2", &result)
		require.NoError(t, err)
		require.Equal(t, float32(3.14), result)
	})
}

func TestExtractStrParam(t *testing.T) {
	makeProcessorParam := func(value string) streamtypes.ProcessorParam {
		return streamtypes.ProcessorParam{
			Value: value,
		}
	}

	t.Run("valid string parameter", func(t *testing.T) {
		metaData := map[string]streamtypes.ProcessorParam{
			"param1": makeProcessorParam("hello"),
		}
		var result string
		err := ExtractStrParam(metaData, "param1", &result)
		require.NoError(t, err)
		require.Equal(t, "hello", result)
	})

	t.Run("parameter not found", func(t *testing.T) {
		metaData := map[string]streamtypes.ProcessorParam{
			"param1": makeProcessorParam("hello"),
		}
		var result string
		err := ExtractStrParam(metaData, "param2", &result)
		require.Error(t, err)
		require.EqualError(t, err, "parameter param2 not found")
	})

	t.Run("metadata is nil", func(t *testing.T) {
		var result string
		err := ExtractStrParam(nil, "param1", &result)
		require.Error(t, err)
		require.EqualError(t, err, "metadata is nil")
	})

	t.Run("result is nil", func(t *testing.T) {
		metaData := map[string]streamtypes.ProcessorParam{
			"param1": makeProcessorParam("hello"),
		}
		err := ExtractStrParam(metaData, "param1", nil)
		require.Error(t, err)
		require.EqualError(t, err, "result is nil")
	})
}

func TestExtractMapParam(t *testing.T) {
	t.Run("header with different types", func(t *testing.T) {
		metaData := map[string]streamtypes.ProcessorParam{
			"headers": makeProcessorMapParam(map[string]any{
				"Content-Type": "text/plain",
				"xxx":          2,
			}),
		}
		var result map[string]any
		err := ExtractMapParam(metaData, "headers", &result)
		require.NoError(t, err)
		require.Equal(t, "text/plain", result["Content-Type"])
		require.Equal(t, 2, result["xxx"])
	})

	t.Run("header with same type", func(t *testing.T) {
		metaData := map[string]streamtypes.ProcessorParam{
			"headers": makeProcessorMapParam(map[string]string{
				"Content-Type": "text/plain",
				"Auth":         "Bearer token",
			}),
		}
		var result map[string]string
		err := ExtractMapParam(metaData, "headers", &result)
		require.NoError(t, err)
		require.Equal(t, "text/plain", result["Content-Type"])
		require.Equal(t, "Bearer token", result["Auth"])
	})
}

func makeProcessorMapParam[T any](mapParamVal map[string]T) streamtypes.ProcessorParam {
	return streamtypes.ProcessorParam{
		Value: mapParamVal,
	}
}
