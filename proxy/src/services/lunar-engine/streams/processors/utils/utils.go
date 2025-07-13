package utils

import (
	"encoding/json"
	"fmt"
	public_types "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// Define a type constraint that includes all numeric types
type Numeric interface {
	~int | ~int8 | ~int16 | ~int32 | ~int64 |
		~uint | ~uint8 | ~uint16 | ~uint32 | ~uint64 |
		~float32 | ~float64
}

type ParsedURL struct {
	Host   string
	Path   string
	Port   string
	Scheme string
}

func NewParsedURL(parsedURL *url.URL) *ParsedURL {
	return &ParsedURL{
		Host:   strings.TrimPrefix(parsedURL.Hostname(), "www."),
		Path:   parsedURL.Path,
		Port:   parsedURL.Port(),
		Scheme: parsedURL.Scheme,
	}
}

// GetHostAndPort returns the host and port of the parsed URL
// If the port is empty, it returns only the host
// If the port is not empty, it returns host:port
// If the host is empty, it returns an empty string
func (p *ParsedURL) GetHostAndPort() string {
	if p.Port != "" {
		return fmt.Sprintf("%s:%s", p.Host, p.Port)
	}
	return p.Host
}

func (p *ParsedURL) GetScheme() string {
	if p.Scheme == "" {
		return "http"
	}
	return p.Scheme
}

// ExtractDomain extracts domain from a URL
func ExtractDomainAndPath(rawURL string) (*ParsedURL, error) {
	if rawURL == "" {
		return nil, fmt.Errorf("empty URL provided")
	}

	// Attempt to parse rawURL as a full URL
	parsedURL, err := url.Parse(rawURL)
	if err == nil && parsedURL.Host != "" {
		return NewParsedURL(parsedURL), nil
	}

	// If parsing failed or there's no host, treat rawURL as a domain or path
	// Prepend a scheme to parse it correctly
	parsedURL, err = url.Parse("http://" + rawURL)
	if err == nil {
		return NewParsedURL(parsedURL), nil
	}

	// As a fallback, split rawURL manually
	parts := strings.SplitN(rawURL, "/", 2)
	host := parts[0]
	host = strings.TrimPrefix(host, "www.")
	hostParts := strings.Split(host, ":")
	if len(hostParts) > 1 {
		host = hostParts[0]
	}
	port := ""
	if len(hostParts) > 2 {
		port = hostParts[1]
	}
	path := ""
	if len(parts) > 1 {
		path = "/" + parts[1]
	}
	return &ParsedURL{Host: host, Path: path, Port: port}, nil
}

// ContainsRegexPattern checks if a string contains recognizable regex syntax,
// but excludes plain wildcard usage and common non-regex characters like dots.
func ContainsRegexPattern(str string) bool {
	// This list includes special regex characters indicating actual patterns
	regexIndicators := []string{
		"^", "$", "[", "]", "(", ")", "{", "}", "|", "\\", "+", "?", ".*", ".+", "\\d", "\\w",
	}

	for _, ch := range regexIndicators {
		if strings.Contains(str, ch) {
			return true
		}
	}
	return false
}

// ConvertStreamToDataMap converts APIStreamI to map[string]any
func ConvertStreamToDataMap(obj public_types.APIStreamI) (map[string]any, error) {
	jsonData, err := json.Marshal(obj)
	if err != nil {
		return nil, err
	}

	var data map[string]any
	err = json.Unmarshal(jsonData, &data)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON to map: %w", err)
	}
	return data, nil
}

func ExtractStrParam(
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result *string,
) error {
	val, err := extractInput(metaData, paramName, result)
	if err != nil {
		return err
	}

	*result = val.GetString()
	return nil
}

func ExtractIntParam(
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result *int,
) error {
	val, err := extractInput(metaData, paramName, result)
	if err != nil {
		return err
	}
	*result = val.GetInt()
	return nil
}

func ExtractBoolParam(
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result *bool,
) error {
	val, err := extractInput(metaData, paramName, result)
	if err != nil {
		return err
	}
	*result = val.GetBool()
	return nil
}

func ExtractInt64Param(
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result *int64,
) error {
	var intVal int
	err := ExtractIntParam(metaData, paramName, &intVal)
	if err != nil {
		return err
	}
	*result = int64(intVal)
	return nil
}

func ExtractFloat64Param(
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result *float64,
) error {
	val, err := extractInput(metaData, paramName, &result)
	if err != nil {
		return err
	}

	*result = val.GetFloat64()
	return nil
}

func ExtractNumericParam[T Numeric](
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result *T,
) error {
	val, err := extractInput(metaData, paramName, result)
	if err != nil {
		return err
	}

	res, err := convertStringToNumeric[T](val.GetString())
	if err != nil {
		return fmt.Errorf(
			"failed to convert parameter %s to numeric: %w",
			paramName,
			err,
		)
	}
	*result = res
	return nil
}

func ExtractMapOfIntParam(
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result map[string]int,
) error {
	val, err := extractInput(metaData, paramName, &result)
	if err != nil {
		return err
	}

	for k, v := range val.GetMapOfInt() {
		result[k] = v
	}
	return nil
}

func ExtractKVOpParam(
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result *public_types.KVOpParam,
) error {
	val, err := extractInput(metaData, paramName, &result)
	if err != nil {
		return err
	}
	kvOpParam := val.GetKVOpParam()
	if kvOpParam == nil {
		return fmt.Errorf("parameter %s is not a KVOpParam", paramName)
	}
	*result = *kvOpParam
	return nil
}

func ExtractStatusCodeParam(
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result *public_types.StatusCodeParam,
) error {
	val, err := extractInput(metaData, paramName, &result)
	if err != nil {
		return err
	}
	scp := val.GetStatusCodeParam()
	if scp == nil {
		return fmt.Errorf("parameter %s is not a StatusCodeParam", paramName)
	}
	*result = *scp
	return nil
}

func ExtractListOfStringParam(
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result *[]string,
) error {
	val, err := extractInput(metaData, paramName, &result)
	if err != nil {
		return err
	}

	*result = []string{}
	*result = append(*result, val.GetListOfString()...)
	return nil
}

func ExtractListOfIntParam(
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result *[]int,
) error {
	val, err := extractInput(metaData, paramName, &result)
	if err != nil {
		return err
	}

	*result = []int{}
	*result = append(*result, val.GetListOfInt()...)
	return nil
}

func ExtractListOfFloat64Param(
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result *[]float64,
) error {
	val, err := extractInput(metaData, paramName, &result)
	if err != nil {
		return err
	}

	*result = []float64{}
	*result = append(*result, val.GetListOfFloat64()...)
	return nil
}

func ExtractDurationInSecParam(
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result *time.Duration,
) error {
	var intVal int
	err := ExtractIntParam(metaData, paramName, &intVal)
	if err != nil {
		return err
	}

	*result = time.Duration(intVal) * time.Second
	return nil
}

func ExtractMapOfInt64Param(
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result map[string]int64,
) error {
	val, err := extractInput(metaData, paramName, &result)
	if err != nil {
		return err
	}
	for k, v := range val.GetMapOfInt() {
		result[k] = int64(v)
	}
	return nil
}

func ExtractMapOfStringParam(
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result map[string]string,
) error {
	val, err := extractInput(metaData, paramName, &result)
	if err != nil {
		return err
	}
	for k, v := range val.GetMapOfString() {
		result[k] = v
	}
	return nil
}

func ExtractMapOfAnyParam(
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result map[string]any,
) error {
	val, err := extractInput(metaData, paramName, &result)
	if err != nil {
		return err
	}

	for k, v := range val.GetMapOfAny() {
		result[k] = v
	}
	return nil
}

func ExtractMapFromParams(
	metaData map[string]streamtypes.ProcessorParam,
	result *map[string]string,
	excludeParams ...string,
) error {
	if metaData == nil {
		return fmt.Errorf("metadata is nil")
	}
	if result == nil {
		return fmt.Errorf("result is nil")
	}

	excludeMap := make(map[string]bool)
	for _, param := range excludeParams {
		excludeMap[param] = true
	}

	for paramName := range metaData {
		if excludeMap[paramName] {
			continue
		}
		var valStr string
		if err := ExtractStrParam(metaData, paramName, &valStr); err != nil {
			return err
		}
		(*result)[paramName] = valStr
	}
	return nil
}

// ExtractKeyValuePair extracts key=value pair from a string
func ExtractKeyValuePair(raw string) (string, string) {
	parts := strings.Split(raw, "=")
	if len(parts) != 2 {
		log.Trace().Msgf("failed to extract key=val pair from %s", raw)
		return "", ""
	}
	return parts[0], parts[1]
}

// Function to convert string to numeric type T
func convertStringToNumeric[T Numeric](strVal string) (T, error) {
	var zero T
	switch any(zero).(type) {
	case int:
		v, err := strconv.Atoi(strVal)
		return any(v).(T), err
	case int8:
		v, err := strconv.ParseInt(strVal, 10, 8)
		return any(int8(v)).(T), err
	case int16:
		v, err := strconv.ParseInt(strVal, 10, 16)
		return any(int16(v)).(T), err
	case int32:
		v, err := strconv.ParseInt(strVal, 10, 32)
		return any(int32(v)).(T), err
	case int64:
		v, err := strconv.ParseInt(strVal, 10, 64)
		return any(int64(v)).(T), err
	case uint:
		v, err := strconv.ParseUint(strVal, 10, 0)
		return any(uint(v)).(T), err
	case uint8:
		v, err := strconv.ParseUint(strVal, 10, 8)
		return any(uint8(v)).(T), err
	case uint16:
		v, err := strconv.ParseUint(strVal, 10, 16)
		return any(uint16(v)).(T), err
	case uint32:
		v, err := strconv.ParseUint(strVal, 10, 32)
		return any(uint32(v)).(T), err
	case uint64:
		v, err := strconv.ParseUint(strVal, 10, 64)
		return any(uint64(v)).(T), err
	case float32:
		v, err := strconv.ParseFloat(strVal, 32)
		return any(float32(v)).(T), err
	case float64:
		v, err := strconv.ParseFloat(strVal, 64)
		return any(v).(T), err
	default:
		return zero, fmt.Errorf("unsupported type")
	}
}

func extractInput[T any](
	metaData map[string]streamtypes.ProcessorParam,
	paramName string,
	result *T,
) (*public_types.ParamValue, error) {
	if metaData == nil {
		return nil, fmt.Errorf("metadata is nil")
	}
	if result == nil {
		return nil, fmt.Errorf("result is nil")
	}
	val, found := metaData[paramName]
	if !found {
		return nil, fmt.Errorf("parameter %s not found", paramName)
	}
	return val.Value, nil
}
