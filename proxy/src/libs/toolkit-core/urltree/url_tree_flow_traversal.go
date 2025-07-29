package urltree

import (
	"github.com/rs/zerolog/log"
)

func (urlTree *URLTree[T]) Traversal(url string) LookupFlowResult[T] {
	log.Trace().Msgf("Looking up %v in tree", url)
	// Once updated, lookup can be performed
	lookupNodeResult := lookupFlow(urlTree, url)

	res := LookupFlowResult[T]{
		Value:         lookupNodeResult.found,
		NormalizedURL: lookupNodeResult.existingURLPath,
		PathParams:    lookupNodeResult.pathParams,
	}

	return res
}

func lookupFlow[T any](urlTree *URLTree[T], url string) lookupFlowNodeResult[T] {
	splitURL := splitURL(url)
	lookUpLength := len(splitURL) - 1
	currentNode := urlTree.Root
	var params = map[string]string{}
	flows := []T{}
	index := 0

	var part urlPart
	for index, part = range splitURL {
		log.Trace().Msgf("lookupFlowNodeResult::Looking up part %v", part)
		if currentNode.WildcardChild != nil && currentNode.WildcardChild.hasValue() {
			flows = append(flows, *currentNode.WildcardChild.Value)
		}

		child, found := currentNode.ConstantChildren[part.Value]
		if found && child.IsPartOfHost == part.IsPartOfHost {
			currentNode = child
			continue
		}

		parametricChild := currentNode.ParametricChild.Child
		if parametricChild != nil &&
			parametricChild.IsPartOfHost == part.IsPartOfHost {
			// capture the actual segment under the param name
			params[currentNode.ParametricChild.Name] = part.Value
			currentNode = parametricChild
			continue
		}

		break
	}

	if index == lookUpLength && currentNode.hasValue() && currentNode.WildcardChild == nil {
		flows = append(flows, *currentNode.Value)
	} else if index == lookUpLength && part.IsPartOfHost &&
		currentNode.WildcardChild != nil && currentNode.WildcardChild.hasValue() {
		// case where url is host without path and filter ends with a wildcard, for example:
		// url: "host.com", filter: "host.com/*"
		flows = append(flows, *currentNode.WildcardChild.Value)
	}

	for _, flow := range flows {
		log.Trace().Msgf("lookupFlowNodeResult::Found flow: %v", flow)
	}

	return buildLookupFlowNodeResult(flows, params, "")
}
