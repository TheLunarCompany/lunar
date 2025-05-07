package harcollector

import (
	"fmt"
	"lunar/engine/streams/stream"
	"lunar/engine/utils/obfuscation"
	"lunar/toolkit-core/jsonpath"
	"net/url"
	"strings"

	public_types "lunar/engine/streams/public-types"

	"github.com/rs/zerolog/log"
)

type apiStreamObfuscator struct {
	obfuscateEnabled    bool
	obfuscateExclusions []string
	obfuscator          obfuscation.Obfuscator
	apiObject           map[string]interface{}
}

func newAPIStreamObfuscator(
	obfuscateEnabled bool,
	obfuscateExclusions []string,
	apiStream public_types.APIStreamI,
) *apiStreamObfuscator {
	return &apiStreamObfuscator{
		obfuscateEnabled:    obfuscateEnabled,
		obfuscateExclusions: obfuscateExclusions,
		obfuscator:          obfuscation.Obfuscator{Hasher: obfuscation.MD5Hasher{}},
		apiObject:           stream.AsObject(apiStream),
	}
}

// ObfuscateHeader obfuscates the given header value
func (o *apiStreamObfuscator) ObfuscateHeader(key, value string) string {
	return o.obfuscate(key, []string{value}, extractHeaderKeyFromJSONPath)[0]
}

// ObfuscateRequestBody obfuscates the given request body
func (o *apiStreamObfuscator) ObfuscateRequestBody(body string) string {
	return o.obfuscateBody(body, "$.request.body")
}

// ObfuscateResponseBody obfuscates the given response body
func (o *apiStreamObfuscator) ObfuscateResponseBody(body string) string {
	return o.obfuscateBody(body, "$.response.body")
}

// ObfuscateQueryParam obfuscates the given query parameter value
func (o *apiStreamObfuscator) ObfuscateQueryParam(key string, values []string) []string {
	return o.obfuscate(key, values, extractQueryParamKeyFromJSONPath)
}

// ObfuscatePathParam obfuscates the URL path
// Support exclusions like this:
// $.request.path_segments[?(@ == "users")]
// $.request.path_segments[1]
// $.request.path_segments[*]
func (o *apiStreamObfuscator) ObfuscateURLPath(parsedURL *url.URL) string {
	if !o.obfuscateEnabled {
		return parsedURL.String()
	}

	// Split path into segments (e.g., ["users", "1234", "orders", "5678"])
	pathSegments := strings.Split(parsedURL.Path, "/")

	// Process each segment and obfuscate if needed
	for idx, segment := range pathSegments {
		if segment == "" {
			continue // Skip empty segments
		}

		// Check if this path segment is excluded using JSONPath (wildcard, word-based, or index-based)
		if o.isPathSegmentExcluded(segment) {
			continue
		}

		// Apply obfuscation to the segment
		pathSegments[idx] = o.obfuscator.ObfuscateString(segment)
	}

	// Return the full obfuscated URL
	obfuscatedPath := strings.Join(pathSegments, "/")
	return fmt.Sprintf("%s://%s%s", parsedURL.Scheme, parsedURL.Host, obfuscatedPath)
}

func (o *apiStreamObfuscator) obfuscateBody(body, bodyExclusionsPrefix string) string {
	if !o.obfuscateEnabled || body == "" {
		return body
	}

	// Filter out exclusions specific to body obfuscation
	bodyExclusions := o.filterBodyExclusions(bodyExclusionsPrefix)

	obfuscatedBody, err := o.obfuscator.ObfuscateJSON(body, bodyExclusions)
	if err != nil {
		log.Debug().Msg("Failed to obfuscate body JSON. Returning obfuscated raw body string")
		return o.obfuscator.ObfuscateString(body)
	}
	return obfuscatedBody
}

func (o *apiStreamObfuscator) obfuscate(
	key string,
	values []string,
	extractKeyFunc func(string) string,
) []string {
	if !o.obfuscateEnabled {
		return values
	}

	for _, exclusion := range o.obfuscateExclusions {
		if !o.existsInJSONPath(strings.ToLower(exclusion)) {
			continue
		}
		excludedKey := extractKeyFunc(exclusion)
		if strings.EqualFold(excludedKey, key) {
			return values
		}
	}

	obfuscatedValues := make([]string, len(values))
	for i, v := range values {
		obfuscatedValues[i] = o.obfuscator.ObfuscateString(v)
	}
	return obfuscatedValues
}

// isPathSegmentExcluded checks if the given path segment should be excluded from obfuscation
func (o *apiStreamObfuscator) isPathSegmentExcluded(segment string) bool {
	// if any JSONPath-based exclusions match
	for _, exclusion := range o.obfuscateExclusions {
		// Wildcard exclusion (excludes all path segments)
		if exclusion == "$.request.path_segments[*]" {
			return true
		}

		// Word-based exclusion (e.g., `$.request.path_segments[?(@ == "users")]`)
		if strings.Contains(exclusion, "[?(@ ==") {
			excludedWord := extractExcludedWordFromJSONPath(exclusion)
			if excludedWord == segment {
				return true
			}
		}

		// Index-based exclusion (e.g., `$.request.path_segments[1]`)
		if val, err := jsonpath.GetJSONPathValue(o.apiObject, exclusion); err == nil && val == segment {
			return true
		}
	}
	return false
}

// filterBodyExclusions filters out exclusions that are specific to the request or response body
func (o *apiStreamObfuscator) filterBodyExclusions(exclusionPrefix string) []string {
	var bodyExclusions []string
	for _, exclusion := range o.obfuscateExclusions {
		if strings.HasPrefix(exclusion, exclusionPrefix) {
			bodyExclusions = append(bodyExclusions, exclusion)
		}
	}
	return bodyExclusions
}

// extractExcludedWordFromJSONPath extracts the excluded word
// from a JSONPath exclusion like `$.request.path_segments[?(@ == "users")]`
func extractExcludedWordFromJSONPath(jsonPath string) string {
	start := strings.Index(jsonPath, "(@ == \"") + 7
	end := strings.LastIndex(jsonPath, "\")]")
	if start != -1 && end != -1 && end > start {
		return jsonPath[start:end] // Extract excluded word (e.g., "users")
	}
	return ""
}

// existsInJSONPath checks if the given JSON path exists in the API object
func (o *apiStreamObfuscator) existsInJSONPath(jsonPath string) bool {
	_, err := jsonpath.GetJSONPathValue(o.apiObject, jsonPath)
	return err == nil
}

// Extracts the header key from JSONPath exclusions like `$.response.headers["Retry-after"]`
func extractHeaderKeyFromJSONPath(jsonPath string) string {
	startToken := "["
	endToken := "]"
	if strings.Contains(jsonPath, "'") {
		startToken += "'"
		endToken = "'" + endToken
	} else {
		startToken += "\""
		endToken = "\"" + endToken
	}

	start := strings.Index(jsonPath, startToken)
	end := strings.Index(jsonPath, endToken)
	if start != -1 && end != -1 && end > start+2 {
		return strings.ToLower(jsonPath[start+2 : end]) // Extract header key (e.g., "retry-after")
	}
	return ""
}

// Extracts the query parameter key from JSONPath exclusions like `$.request.query_param.id`
func extractQueryParamKeyFromJSONPath(jsonPath string) string {
	const prefix = "$.request.query_param."
	if strings.HasPrefix(jsonPath, prefix) {
		return strings.TrimPrefix(jsonPath, prefix)
	}
	return ""
}
