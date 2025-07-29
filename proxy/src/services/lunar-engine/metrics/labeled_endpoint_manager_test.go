package metrics

import (
	"regexp"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestConvertPatternToRegex(t *testing.T) {
	tests := []struct {
		name        string
		pattern     string
		matching    []string // URLs that should match the generated regex.
		notMatching []string // URLs that should NOT match the generated regex.
	}{
		{
			name:    "placeholder at end",
			pattern: "queue.com/limited-10/{param}",
			matching: []string{
				"queue.com/limited-10/test",
				"queue.com/limited-10/another",
			},
			notMatching: []string{
				"queue.com/limited-10",
				"queue.com/limited-30/test",
				"queue.com/limited-10/test/123",
			},
		},
		{
			name:    "placeholder in the middle",
			pattern: "queue.com/{param_1}/something",
			matching: []string{
				"queue.com/test/something",
				"queue.com/123/something",
			},
			notMatching: []string{
				"queue.com/test/else",
				"queue.com//something", // placeholder captured empty string; ([^/]+) requires at least one char
			},
		},
		{
			name:    "multiple placeholders",
			pattern: "queue.com/{param1}/{param2}",
			matching: []string{
				"queue.com/alpha/beta",
				"queue.com/one/two",
			},
			notMatching: []string{
				"queue.com/alpha",
				"queue.com/alpha/beta/extra",
			},
		},
		{
			name:    "no placeholders",
			pattern: "queue.com/static",
			matching: []string{
				"queue.com/static",
			},
			notMatching: []string{
				"queue.com/dynamic",
				"queue.com/static/extra",
			},
		},
		{
			name:    "placeholder at beginning",
			pattern: "{subdomain}.queue.com",
			matching: []string{
				"test.queue.com",
				"abc.queue.com",
			},
			notMatching: []string{
				"queue.com",
				"test.queue.co",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			regexStr := convertPatternToRegex(tt.pattern)
			re, err := regexp.Compile(regexStr)
			require.NoError(t, err, "expected regex to compile without error, got error: %v", err)

			for _, url := range tt.matching {
				require.True(
					t,
					re.MatchString(url),
					"expected %q to match pattern %q (regex: %q)",
					url,
					tt.pattern,
					regexStr,
				)
			}

			// Check that URLs expected NOT to match do not match.
			for _, url := range tt.notMatching {
				require.False(
					t,
					re.MatchString(url),
					"expected %q NOT to match pattern %q (regex: %q)",
					url,
					tt.pattern,
					regexStr,
				)
			}
		})
	}
}
