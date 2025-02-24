package filterprocessor

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCheckURLCondition(t *testing.T) {
	tests := []struct {
		name               string
		filterURLField     string
		inputURL           string
		expectedCondition  string
		expectedFilterUsed string
	}{
		{
			name:               "Exact match",
			filterURLField:     "example.com/path",
			inputURL:           "example.com/path",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "example.com/path",
		},
		{
			name:               "Domain match",
			filterURLField:     "example.com",
			inputURL:           "http://example.com/path",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "example.com",
		},
		{
			name:               "Wildcard match",
			filterURLField:     "example.com/*",
			inputURL:           "http://example.com/path/to/resource",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "example.com/*",
		},
		{
			name:               "Wildcard domain match",
			filterURLField:     "*.example.com",
			inputURL:           "http://sub.example.com/path",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "*.example.com",
		},
		{
			name:               "Regex match",
			filterURLField:     "^example\\.com/.*$",
			inputURL:           "example.com/path/to/resource",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "^example\\.com/.*$",
		},
		{
			name:               "No match",
			filterURLField:     "example.com/path",
			inputURL:           "http://another.com/path",
			expectedCondition:  MissConditionName,
			expectedFilterUsed: "example.com/path",
		},
		{
			name:               "Invalid input URL",
			filterURLField:     "example.com/*",
			inputURL:           "://badurl",
			expectedCondition:  MissConditionName,
			expectedFilterUsed: "example.com/*",
		},
		{
			name:              "Empty filter",
			filterURLField:    "",
			inputURL:          "http://example.com/path",
			expectedCondition: "",
		},
		{
			name:               "Wildcard in middle of domain",
			filterURLField:     "example.*.com",
			inputURL:           "http://example.sub.com",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "example.*.com",
		},
		{
			name:               "Wildcard path",
			filterURLField:     "example.com/*/resource",
			inputURL:           "http://example.com/path/resource",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "example.com/*/resource",
		},
		{
			name:               "Filter is a regex that doesn't match",
			filterURLField:     "^example\\.com/resource$",
			inputURL:           "example.com/path/resource",
			expectedCondition:  MissConditionName,
			expectedFilterUsed: "^example\\.com/resource$",
		},
		{
			name:               "Filter is an invalid regex",
			filterURLField:     "[example.com",
			inputURL:           "example.com/path",
			expectedCondition:  MissConditionName,
			expectedFilterUsed: "[example.com",
		},
		{
			name:               "Input URL with www prefix",
			filterURLField:     "example.com/path",
			inputURL:           "http://www.example.com/path",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "example.com/path",
		},
		{
			name:               "Filter with protocol",
			filterURLField:     "http://example.com/path",
			inputURL:           "https://example.com/path",
			expectedCondition:  MissConditionName,
			expectedFilterUsed: "http://example.com/path",
		},
		{
			name:               "Url Filter with protocol",
			filterURLField:     "http://example.com/path",
			inputURL:           "http://example.com/path",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "http://example.com/path",
		},
		{
			name:               "Url Filter with protocol and www",
			filterURLField:     "http://www.example.com/path",
			inputURL:           "http://www.example.com/path",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "http://www.example.com/path",
		},
		{
			name:               "Url Filter with protocol and wildcard in domain",
			filterURLField:     "http://*.example.com",
			inputURL:           "http://api.example.com",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "http://*.example.com",
		},
		{
			name:               "Url Filter with protocol and wildcard",
			filterURLField:     "http://example.com/path/*",
			inputURL:           "http://example.com/path/resource",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "http://example.com/path/*",
		},
		{
			name:               "Filter domain with different case",
			filterURLField:     "Example.COM",
			inputURL:           "http://example.com/path",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "example.com",
		},
		{
			name:               "Input URL with query parameters",
			filterURLField:     "example.com/path",
			inputURL:           "http://example.com/path?query=123",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "example.com/path",
		},
		{
			name:               "Filter with query parameters",
			filterURLField:     "http://example.com/path?query=123",
			inputURL:           "http://example.com/path?query=123",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "http://example.com/path?query=123",
		},
		{
			name:               "Filter with wrong query parameters",
			filterURLField:     "http://example.com/path?query=123",
			inputURL:           "http://example.com/path?query=456",
			expectedCondition:  MissConditionName,
			expectedFilterUsed: "http://example.com/path?query=123",
		},
		{
			name:               "Filter with path and input URL without path",
			filterURLField:     "example.com/path",
			inputURL:           "http://example.com",
			expectedCondition:  MissConditionName,
			expectedFilterUsed: "example.com/path",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			conditions := make(map[string]string)
			checkURLCondition(conditions, tc.filterURLField, tc.inputURL)

			if tc.expectedCondition == "" {
				require.Empty(t, conditions, "Expected conditions to be empty")
			} else {
				require.Contains(t, conditions, tc.expectedCondition)
				require.Equal(t, tc.expectedFilterUsed, conditions[tc.expectedCondition])
			}
		})
	}
}
