package utils

import (
	"sort"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDumpHeaders(t *testing.T) {
	t.Parallel()
	input := map[string]string{
		"Auth":         "Bla",
		"Content-Type": "application/json",
	}

	res := DumpHeaders(input)
	slicedRes := strings.Split(strings.Trim(res, "\n"), "\n")
	wantParts := []string{"Auth:Bla", "Content-Type:application/json"}
	sort.Strings(slicedRes)
	sort.Strings(wantParts)
	assert.Equal(t, slicedRes, wantParts)
}

func TestParseHeaders(t *testing.T) {
	t.Parallel()
	input := "Auth: Bla\nContent-Type: application/json\n"
	res := ParseHeaders(&input)

	want := map[string]string{
		"Auth":         "Bla",
		"Content-Type": "application/json",
	}

	assert.Equal(t, res, want)
}

func TestTransformSlice(t *testing.T) {
	t.Parallel()
	input := []string{"hello", "world"}
	expected := []string{"HELLO", "WORLD"}
	result := TransformSlice(input, strings.ToUpper)
	assert.Equal(t, expected, result)
}

func TestMakeHeadersLowercase(t *testing.T) {
	t.Parallel()
	input := map[string]string{
		"Auth":         "Bla",
		"Content-Type": "application/json",
	}
	expected := map[string]string{
		"auth":         "Bla",
		"content-type": "application/json",
	}
	result := MakeHeadersLowercase(input)
	assert.Equal(t, expected, result)
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
			assert.Equal(t, tt.expected, result)
		})
	}
}
