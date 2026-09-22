package utils

import (
	"bufio"
	"fmt"
	"net/http"
	"net/textproto"
	"strings"

	"github.com/rs/zerolog/log"
	lo "github.com/samber/lo"
)

// Adapted from https://stackoverflow.com/a/22562773
func ParseHeaders(raw *string) map[string]string {
	reader := bufio.NewReader(strings.NewReader(*raw + "\r\n"))
	tp := textproto.NewReader(reader)

	mimeHeader, err := tp.ReadMIMEHeader()
	if err != nil {
		log.Warn().
			Err(err).
			Msg("failed to parse headers, will continue without any headers")
		return map[string]string{}
	}

	httpHeader := http.Header(mimeHeader)

	getFirstValue := func(strings []string, _ string) string {
		if len(strings) < 1 {
			return ""
		}
		return strings[0]
	}
	res := lo.MapValues(httpHeader, getFirstValue)
	return MakeHeadersLowercase(res)
}

func DumpHeaders(headers map[string]string) string {
	pairs := lo.MapToSlice(headers,
		func(k string, v string) string { return fmt.Sprintf("%s:%s", k, v) },
	)
	concatenated := strings.Join(pairs, "\n")
	return fmt.Sprintf("%s\n", concatenated)
}

func DeepCopyHeaders(headers map[string]string) map[string]string {
	targetMap := make(map[string]string)

	for key, value := range headers {
		targetMap[key] = value
	}

	return targetMap
}

func MergeHeaders(
	firstHeaders map[string]string,
	secondHeaders map[string]string,
) map[string]string {
	mergedHeaders := map[string]string{}
	for k, v := range firstHeaders {
		if _, found := secondHeaders[k]; found {
			continue
		}
		mergedHeaders[k] = v
	}
	for k, v := range secondHeaders {
		mergedHeaders[k] = v
	}
	return mergedHeaders
}

func TransformSlice(slice []string, transformation func(s string) string) []string {
	for i, v := range slice {
		slice[i] = transformation(v)
	}
	return slice
}

func MakeHeadersLowercase(headers map[string]string) map[string]string {
	normalizedHeaders := make(map[string]string, len(headers))
	for k, v := range headers {
		normalizedHeaders[strings.ToLower(k)] = v
	}
	return normalizedHeaders
}
