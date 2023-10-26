package urltree

import (
	"fmt"
	"strings"
)

const wildcard = "*"

func NewURLTree[T any]() *URLTree[T] {
	return &URLTree[T]{Root: &Node[T]{}}
}

func (urlTreeNode *Node[T]) hasValue() bool {
	return urlTreeNode != nil && urlTreeNode.Value != nil
}

func validateURL(url string) error {
	splitURL := strings.Split(trimURL(url), "/")
	for _, urlPart := range splitURL {
		if urlPart == "" {
			return fmt.Errorf(
				"URL %v is invalid, URL part cannot be empty",
				url,
			)
		}
		if urlPart == wildcard && urlPart != splitURL[len(splitURL)-1] {
			return fmt.Errorf("URL %v is invalid, "+
				"wildcard is only allowed at the end of a URL", url)
		}
	}
	return nil
}

func ensureInitialized(params map[string]string) map[string]string {
	if params == nil {
		params = map[string]string{}
	}
	return params
}

func buildLookupNodeResult[T any](
	match bool,
	currentNode *Node[T],
	pathParams map[string]string,
	urlPath string,
) lookupNodeResult[T] {
	return lookupNodeResult[T]{
		match:           match,
		node:            currentNode,
		pathParams:      pathParams,
		existingURLPath: trimURL(urlPath),
	}
}

func trimURL(url string) string {
	return strings.TrimSuffix(strings.TrimPrefix(url, "/"), "/")
}

func TryExtractPathParameter(urlPart string) (string, bool) {
	if strings.HasPrefix(urlPart, "{") && strings.HasSuffix(urlPart, "}") {
		return strings.Trim(urlPart, "{}"), true
	}
	return "", false
}
