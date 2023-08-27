package urltree

import (
	"fmt"
	"strings"

	"github.com/rs/zerolog/log"
)

func (urlTree *URLTree[T]) Lookup(url string) LookupResult[T] {
	log.Debug().Msgf("Looking up %v in policies tree", url)
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
	splitURL := strings.Split(url, "/")
	currentNode := urlTree.Root
	var params map[string]string
	var foundWildcardNode *Node[T]
	urlPath := ""
	for _, urlPart := range splitURL {
		if currentNode.WildcardChild != nil {
			foundWildcardNode = currentNode.WildcardChild
		}
		child, found := currentNode.ConstantChildren[urlPart]
		if found {
			currentNode = child
			urlPath += urlPart + "/"
			continue
		}
		parametricChild := currentNode.ParametricChild.Child
		if parametricChild != nil {
			if name, isPathParam := TryExtractPathParameter(urlPart); isPathParam {
				if name != currentNode.ParametricChild.Name {
					log.Warn().Msgf(
						"Path parameter name '%v' does not match existing name '%v'",
						name,
						currentNode.ParametricChild.Name,
					)
				}
			} else {
				params = ensureInitialized(params)
				params[currentNode.ParametricChild.Name] = urlPart
			}
			urlPath += fmt.Sprintf("{%v}/", currentNode.ParametricChild.Name)
			currentNode = parametricChild
			continue
		}

		if _, isPathParam := TryExtractPathParameter(urlPart); isPathParam {
			// Lookup with path parameter, but did not find a parametric child
			return buildLookupNodeResult(false, currentNode, params, urlPath)
		}

		if foundWildcardNode != nil {
			// Didn't find exact value, but found a matching wildcard
			return buildLookupNodeResult(
				true,
				foundWildcardNode,
				params,
				urlPath+wildcard,
			)
		}

		// No match found, return the node that was found with noMatch
		return buildLookupNodeResult(false, currentNode, params, urlPath)
	}
	if currentNode.hasValue() {
		// Non-wildcard match found
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

	// No match found, return the node that was found with noMatch
	return buildLookupNodeResult(false, currentNode, params, urlPath)
}
