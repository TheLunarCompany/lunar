package common

import "github.com/rs/zerolog/log"

func NormalizeURL(tree SimpleURLTreeI, url string) string {
	// The request URL is inserted into the tree in order to effectively
	// normalize it by using this tree's assumed path params feature which
	// is turned on on this instance upon initialization.

	treeUpdateErr := tree.Insert(url, &EmptyStruct{})
	if treeUpdateErr != nil {
		log.Error().
			Err(treeUpdateErr).
			Msgf("Error updating tree with URL: %v", url)
	}
	lookupResult := tree.Lookup(url)
	if !lookupResult.Match {
		log.Trace().Msgf("No match for URL: %v, will return original URL", url)
		return url
	}

	normalizedURL := lookupResult.NormalizedURL

	return normalizedURL
}

func StrictNormalizeURL(tree SimpleURLTreeI, url string) (string, bool) {
	// In this function we do not insert the URL into the tree as done in `NormalizeURL`.
	// This is partially the difference between the two functions. The other difference
	// is that this function returns a boolean indicating whether the URL was found in the
	// tree or not.
	lookupResult := tree.Lookup(url)
	if !lookupResult.Match {
		log.Trace().Msgf("No match for URL: %v", url)
		return "", false
	}

	normalizedURL := lookupResult.NormalizedURL

	return normalizedURL, true
}
