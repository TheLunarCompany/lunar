package urltree

import (
	"fmt"

	"github.com/rs/zerolog/log"
)

func (urlTree *URLTree[T]) Lookup(url string) LookupResult[T] {
	log.Trace().Msgf("Looking up %v in tree", url)
	// Once updated, lookup can be performed
	lookupNodeResult := lookupNode(urlTree, url)

	res := LookupResult[T]{}
	if lookupNodeResult.match {
		res = LookupResult[T]{
			Match:         lookupNodeResult.match,
			Value:         lookupNodeResult.node.Value,
			PathParams:    lookupNodeResult.pathParams,
			NormalizedURL: lookupNodeResult.existingURLPath,
		}
	}

	return res
}

func lookupNode[T any](urlTree *URLTree[T], url string) lookupNodeResult[T] {
	splitURL := splitURL(url)
	currentNode := urlTree.Root
	var params map[string]string
	var foundWildcardNode *Node[T]
	urlPath := ""
	for _, urlPart := range splitURL {
		if currentNode.WildcardChild != nil {
			foundWildcardNode = currentNode.WildcardChild
		}
		child, found := currentNode.ConstantChildren[urlPart.Value]
		if found && child.IsPartOfHost == urlPart.IsPartOfHost {
			currentNode = child
			delimiter := getDelimiter(urlPart)
			urlPath += delimiter + urlPart.Value
			continue
		}

		parametricChild := currentNode.ParametricChild.Child
		if parametricChild != nil &&
			parametricChild.IsPartOfHost == urlPart.IsPartOfHost {
			if name, isPathParam := TryExtractPathParameter(urlPart.Value); isPathParam {
				if name != currentNode.ParametricChild.Name {
					log.Warn().Msgf(
						"Path parameter name '%v' does not match existing name '%v' in url '%v'",
						name,
						currentNode.ParametricChild.Name,
						url,
					)
				}
			} else {
				params = ensureInitialized(params)
				params[currentNode.ParametricChild.Name] = urlPart.Value
			}
			urlPath += fmt.Sprintf(
				"%v{%v}",
				getDelimiter(urlPart),
				currentNode.ParametricChild.Name,
			)
			currentNode = parametricChild
			continue
		}

		if _, isPathParam := TryExtractPathParameter(urlPart.Value); isPathParam {
			// Lookup with path parameter, but did not find a parametric child
			return buildLookupNodeResult(false, currentNode, params, urlPath)
		}

		if foundWildcardNode != nil {
			// Didn't find exact value, but found a matching wildcard
			urlPath = urlPath + getDelimiter(urlPart) + wildcard
			return buildLookupNodeResult(
				true,
				foundWildcardNode,
				params,
				urlPath,
			)
		}

		// No match found, return the node that was found with noMatch
		return buildLookupNodeResult(false, currentNode, params, urlPath)
	}
	if currentNode.hasValue() {
		// Non-wildcard match found
		log.Debug().
			Msgf("1 %v", buildLookupNodeResult(true, currentNode, params, urlPath))
		return buildLookupNodeResult(true, currentNode, params, urlPath)
	}
	// Exact value not found, check if node has wildcard child
	if currentNode.WildcardChild != nil {
		return buildLookupNodeResult(
			true, currentNode.WildcardChild, params, urlPath)
	}
	// Check if a matching wildcard was found in a parent node
	if foundWildcardNode != nil {
		return buildLookupNodeResult(true, foundWildcardNode, params, urlPath)
	}

	log.Debug().
		Msgf("2 %v", buildLookupNodeResult(false, currentNode, params, urlPath))
	// No match found, return the node that was found with noMatch
	return buildLookupNodeResult(false, currentNode, params, urlPath)
}

func getDelimiter(urlPart urlPart) string {
	if urlPart.IsPartOfHost {
		return "."
	}
	return "/"
}
