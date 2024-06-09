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

type urlPart struct {
	IsPartOfHost bool
	Value        string
}

func splitURL(url string) []urlPart {
	splitURL := strings.Split(url, "/")
	splitHost := strings.Split(splitURL[0], ".")
	splitPath := splitURL[1:]

	labeledParts := []urlPart{}
	for _, hostPart := range splitHost {
		labeledParts = append(labeledParts, urlPart{IsPartOfHost: true, Value: hostPart})
	}
	for _, pathPart := range splitPath {
		labeledParts = append(labeledParts, urlPart{IsPartOfHost: false, Value: pathPart})
	}
	return labeledParts
}

func validateURL(url string) error {
	splitURL := splitURL(url)

	for _, urlPart := range splitURL {
		if urlPart.Value == "" {
			return fmt.Errorf(
				"URL %v is invalid, URL part cannot be empty",
				url,
			)
		}
		if urlPart.Value == wildcard && urlPart != splitURL[len(splitURL)-1] {
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
	return strings.Trim(url, "./")
}

func TryExtractPathParameter(urlPart string) (string, bool) {
	if strings.HasPrefix(urlPart, "{") && strings.HasSuffix(urlPart, "}") {
		return strings.Trim(urlPart, "{}"), true
	}
	return "", false
}
