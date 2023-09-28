package common

import "github.com/rs/zerolog/log"

func NormalizeURL(tree SimpleURLTreeI, url string) string {
	lookupResult := tree.Lookup(url)
	if !lookupResult.Match {
		log.Trace().Msgf("No match for URL: %v, will return original URL", url)
		return url
	}

	normalizedURL := lookupResult.NormalizedURL

	return normalizedURL
}

func StrictNormalizeURL(tree SimpleURLTreeI, url string) (string, bool) {
	lookupResult := tree.Lookup(url)
	if !lookupResult.Match {
		log.Trace().Msgf("No match for URL: %v", url)
		return "", false
	}

	normalizedURL := lookupResult.NormalizedURL

	return normalizedURL, true
}
