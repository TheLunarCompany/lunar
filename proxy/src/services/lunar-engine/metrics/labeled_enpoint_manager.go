package metrics

import (
	"lunar/engine/utils"
	"regexp"
	"strings"
	"sync"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/attribute"
)

const pathLabel = "path"

type LabeledEndpointManager struct {
	mu                     sync.RWMutex
	supportedLabelPatterns []string
}

// NewLabeledEndpointManager creates a new instance of LabeledEndpointManager
func NewLabeledEndpointManager(labeledEndpoints []string) *LabeledEndpointManager {
	mng := &LabeledEndpointManager{}
	mng.SetLabeledEndpoints(labeledEndpoints)
	return mng
}

// SetLabeledEndpoints sets the labeled endpoints
func (m *LabeledEndpointManager) SetLabeledEndpoints(labeledEndpoints []string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.supportedLabelPatterns = nil
	for _, label := range labeledEndpoints {
		m.supportedLabelPatterns = append(m.supportedLabelPatterns, convertPatternToRegex(label))
	}

	log.Info().Msgf("Supported labeled endpoints: %v", labeledEndpoints)
}

// ExtractLabeledEndpoint check if specified url is defined as labeled endpoint
// and returns the attribute path label if found
func (m *LabeledEndpointManager) ExtractLabel(url string) *attribute.KeyValue {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, pattern := range m.supportedLabelPatterns {
		if matched, _ := regexp.MatchString(pattern, url); matched {
			if path := utils.ExtractPath(url); path != "" {
				pathAttribute := attribute.String(pathLabel, path)
				return &pathAttribute
			}
		}
	}
	return nil
}

// convertPatternToRegex converts a URL definition with placeholders (e.g. "{param}")
// into a regex string that will match URLs where the value inside the curly braces
// can change. In this example, the placeholder is replaced with "([^/]+)", which
// matches one or more characters that are not a slash.
//
// The literal parts of the pattern are escaped so that any regex special characters
// (like "." or "-") are treated literally.
func convertPatternToRegex(pattern string) string {
	// regex to find placeholders (everything between "{" and "}")
	placeholderRegex := regexp.MustCompile(`\{[^}]+\}`)

	var builder strings.Builder
	lastIndex := 0
	for _, match := range placeholderRegex.FindAllStringIndex(pattern, -1) {
		start, end := match[0], match[1]
		builder.WriteString(regexp.QuoteMeta(pattern[lastIndex:start]))
		// Replace the placeholder with a regex capturing group.
		// "([^/]+)" matches one or more characters (except the '/')
		builder.WriteString("([^/]+)")
		lastIndex = end
	}
	// Append any remaining literal text after the last placeholder.
	builder.WriteString(regexp.QuoteMeta(pattern[lastIndex:]))

	// Anchor the regex to match the entire string.
	return "^" + builder.String() + "$"
}
