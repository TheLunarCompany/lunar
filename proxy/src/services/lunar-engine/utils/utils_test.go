package utils

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSliceToMap(t *testing.T) {
	t.Run("non-empty slice", func(t *testing.T) {
		slice := []string{"a", "b", "c"}
		expected := map[string]string{"a": "a", "b": "b", "c": "c"}
		result := SliceToMap(slice)
		require.Equal(t, expected, result)
	})

	t.Run("empty slice", func(t *testing.T) {
		slice := []string{}
		expected := map[string]string{}
		result := SliceToMap(slice)
		require.Equal(t, expected, result)
	})

	t.Run("slice with duplicate values", func(t *testing.T) {
		slice := []string{"a", "b", "a"}
		expected := map[string]string{"a": "a", "b": "b"}
		result := SliceToMap(slice)
		require.Equal(t, expected, result)
	})

	t.Run("slice with special characters", func(t *testing.T) {
		slice := []string{"a", "b", "c", "d-e", "f_g"}
		expected := map[string]string{"a": "a", "b": "b", "c": "c", "d-e": "d-e", "f_g": "f_g"}
		result := SliceToMap(slice)
		require.Equal(t, expected, result)
	})
}

func TestExtractHost(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name     string
		rawURL   string
		expected string
	}{
		{
			name:     "Valid URL with http",
			rawURL:   "http://example.com/path",
			expected: "example.com",
		},
		{
			name:     "Valid URL with https",
			rawURL:   "https://example.com/path",
			expected: "example.com",
		},
		{
			name:     "URL with port",
			rawURL:   "http://example.com:8080/path",
			expected: "example.com:8080",
		},
		{
			name:     "URL with no scheme",
			rawURL:   "api.google.com/endpoint/1",
			expected: "api.google.com",
		},
		{
			name:     "Converged URL",
			rawURL:   "twitter.com/user/{id}/photo/{photo_id}",
			expected: "twitter.com",
		},
		{
			name:     "Invalid URL",
			rawURL:   "http://",
			expected: "",
		},
		{
			name:     "Empty URL",
			rawURL:   "",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ExtractHost(tt.rawURL)
			require.Equal(t, tt.expected, result)
		})
	}
}
