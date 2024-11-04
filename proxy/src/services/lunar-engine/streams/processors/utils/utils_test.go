package utils

import (
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestContainsRegexPattern(t *testing.T) {
	// Case: String with wildcard, should return false
	wildcardString := "This is a wildcard pattern like/*"
	require.False(t, ContainsRegexPattern(wildcardString), "Wildcard pattern should not be considered as regex")

	// Case: String with simple regex characters, should return true
	regexString := "This looks like a regex: ^[a-z]+$"
	require.True(t, ContainsRegexPattern(regexString), "Regex pattern should be identified as regex")

	// Case: String with mix of wildcard and regex, should return true
	mixedString := "This is mixed: * and [a-z]+"
	require.True(t, ContainsRegexPattern(mixedString), "Mixed pattern containing regex should be identified as regex")

	// Case: String with no special characters, should return false
	plainString := "Just a normal sentence"
	require.False(t, ContainsRegexPattern(plainString), "Plain string should not be considered as regex")

	// Case: String with escaped regex characters, should return true
	escapedRegexString := `This string has escaped regex: \\d+`
	require.True(t, ContainsRegexPattern(escapedRegexString), "Escaped regex pattern should be identified as regex")

	// Case: String with empty input, should return false
	emptyString := ""
	require.False(t, ContainsRegexPattern(emptyString), "Empty string should not be considered as regex")
}

func TestExtractDomainAndPath(t *testing.T) {
	tests := []struct {
		name           string
		input          string
		expectedDomain string
		expectedPath   string
		hasError       bool
	}{
		{"Full URL", "https://www.example.com/path?query=value", "example.com", "/path", false},
		{"URL without scheme", "www.example.com/path", "example.com", "/path", false},
		{"URL with wildcard", "https://www.example.com/*/something", "example.com", "/*/something", false},
		{"Domain only", "example.com", "example.com", "", false},
		{"Subdomain", "sub.example.com", "sub.example.com", "", false},
		{"IP address", "192.168.1.1", "192.168.1.1", "", false},
		{"Empty string", "", "", "", true},
		{"Domain with path", "example.com/path", "example.com", "/path", false},
		{"Domain with path and wildcard", "example.com/path/*", "example.com", "/path/*", false},
		{"Subdomain with path", "sub.example.com/path", "sub.example.com", "/path", false},
		{"Subdomain with path and wildcard", "sub.example.com/path/*", "sub.example.com", "/path/*", false},
		{"Subdomain with wildcard and path", "*.example.com/path", "*.example.com", "/path", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parsedURL, err := ExtractDomainAndPath(tt.input)
			if tt.hasError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expectedDomain, parsedURL.Host)
				require.Equal(t, tt.expectedPath, parsedURL.Path)
			}
		})
	}
}

func TestExtractNumericParam(t *testing.T) {
	makeProcessorParam := func(value string) streamtypes.ProcessorParam {
		param := publictypes.NewKeyValue("test", value)
		return streamtypes.ProcessorParam{
			Value: param.GetParamValue(),
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
		param := publictypes.NewKeyValue("test", value)
		return streamtypes.ProcessorParam{
			Value: param.GetParamValue(),
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

func TestExtractMapFromParams(t *testing.T) {
	makeProcessorParam := func(value string) streamtypes.ProcessorParam {
		param := publictypes.NewKeyValue("test", value)
		return streamtypes.ProcessorParam{
			Value: param.GetParamValue(),
		}
	}

	t.Run("extract map from params", func(t *testing.T) {
		metaData := map[string]streamtypes.ProcessorParam{
			"param1": makeProcessorParam("value1"),
			"param2": makeProcessorParam("value2"),
			"param3": makeProcessorParam("value3"),
		}
		result := make(map[string]string)
		err := ExtractMapFromParams(metaData, &result)
		require.NoError(t, err)
		require.Equal(t, "value1", result["param1"])
		require.Equal(t, "value2", result["param2"])
		require.Equal(t, "value3", result["param3"])
	})

	t.Run("exclude params", func(t *testing.T) {
		metaData := map[string]streamtypes.ProcessorParam{
			"param1": makeProcessorParam("value1"),
			"param2": makeProcessorParam("value2"),
			"param3": makeProcessorParam("value3"),
		}
		result := make(map[string]string)
		err := ExtractMapFromParams(metaData, &result, "param2", "param3")
		require.NoError(t, err)
		require.Equal(t, "value1", result["param1"])
		_, param2Exists := result["param2"]
		require.False(t, param2Exists)
		_, param3Exists := result["param3"]
		require.False(t, param3Exists)
	})

	t.Run("metadata is nil", func(t *testing.T) {
		var result map[string]string
		err := ExtractMapFromParams(nil, &result)
		require.Error(t, err)
		require.EqualError(t, err, "metadata is nil")
	})

	t.Run("result is nil", func(t *testing.T) {
		metaData := map[string]streamtypes.ProcessorParam{
			"param1": makeProcessorParam("value1"),
			"param2": makeProcessorParam("value2"),
			"param3": makeProcessorParam("value3"),
		}
		err := ExtractMapFromParams(metaData, nil)
		require.Error(t, err)
		require.EqualError(t, err, "result is nil")
	})
}
