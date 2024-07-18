package urltree

import (
	"fmt"
	"sort"

	"github.com/rs/zerolog/log"

	"github.com/samber/lo"
)

func (urlTree *URLTree[T]) Insert(
	url string,
	value *T,
) error {
	_, err := urlTree.InsertWithConvergenceIndication(url, value)
	return err
}

func (urlTree *URLTree[T]) InsertWithConvergenceIndication(
	url string,
	value *T,
) (bool, error) {
	convergenceOccurred := false
	log.Debug().Msgf("Inserting %v into tree", url)
	err := validateURL(url)
	if err != nil {
		return convergenceOccurred, err
	}

	splitURL := splitURL(url)
	assumedPathParamCount := 0
	currentNode := urlTree.Root
	for _, urlPart := range splitURL {
		// Handle wildcard first
		if urlPart.Value == wildcard {
			currentNode.WildcardChild = &Node[T]{
				IsPartOfHost: urlPart.IsPartOfHost,
			}
			currentNode = currentNode.WildcardChild
			log.Debug().Msgf("created wildcard child %v", urlPart.Value)
			continue
		}
		// Handle explicit path params
		if paramName, isPathParam := TryExtractPathParameter(urlPart.Value); isPathParam {
			if currentNode.ParametricChild.Child != nil {
				if paramName != currentNode.ParametricChild.Name {
					return convergenceOccurred, fmt.Errorf(
						"path parameter name '%v' does not match existing name '%v'",
						paramName,
						currentNode.ParametricChild.Name,
					)
				}
			} else {
				currentNode.ParametricChild = ParametricChild[T]{
					Name:  paramName,
					Child: &Node[T]{IsPartOfHost: urlPart.IsPartOfHost},
				}
			}
			currentNode = currentNode.ParametricChild.Child
			log.Debug().Msgf("created path parameter %v", paramName)
			continue
		}
		log.Debug().
			Msgf("current node children count %v", len(currentNode.ConstantChildren))
		// Ensure constant children map is initialized
		if currentNode.ConstantChildren == nil {
			currentNode.ConstantChildren = map[string]*Node[T]{}
		}
		_, partAlreadyExistsInConstants := currentNode.ConstantChildren[urlPart.Value]

		currentConstantPathOnlyChildNodes := []*Node[T]{}
		currentConstantHostOnlyChildNodes := map[string]*Node[T]{}
		for part, child := range currentNode.ConstantChildren {
			if child.IsPartOfHost {
				currentConstantHostOnlyChildNodes[part] = child
			} else {
				currentConstantPathOnlyChildNodes = append(currentConstantPathOnlyChildNodes, child)
			}
		}

		isThresholdMet := len(
			currentConstantPathOnlyChildNodes,
		) >= urlTree.maxSplitThreshold

		// Handle assumed path params if needed (before adding to ConstantChildren)
		if urlTree.assumedPathParamsEnabled && isThresholdMet &&
			!partAlreadyExistsInConstants {
			// Converge both children and parametric children
			convergedChild := convergeNodesPaths(
				append(
					currentConstantPathOnlyChildNodes,
					currentNode.ParametricChild.Child,
				),
			)
			convergenceOccurred = true
			log.Debug().Msgf("Tree was converged after %v", urlPart.Value)
			currentNode.ConstantChildren = currentConstantHostOnlyChildNodes

			assumedPathParamCount++
			currentNode.ParametricChild = ParametricChild[T]{
				Name: fmt.Sprintf(
					"_param_%v",
					assumedPathParamCount,
				),
				Child: convergedChild,
			}
			currentNode = currentNode.ParametricChild.Child
			continue
		}

		// Insert into path params if assumed path params are enabled
		if urlTree.assumedPathParamsEnabled &&
			currentNode.ParametricChild.Child != nil {
			assumedPathParamCount++
			currentNode = currentNode.ParametricChild.Child
			continue
		}

		// Insert into constant children if not already there
		if _, found := currentNode.ConstantChildren[urlPart.Value]; !found {
			currentNode.ConstantChildren[urlPart.Value] = &Node[T]{
				IsPartOfHost: urlPart.IsPartOfHost,
			}
		}
		currentNode = currentNode.ConstantChildren[urlPart.Value]
	}
	currentNode.Value = value

	return convergenceOccurred, nil
}

// This function converges a slice of nodes into a single node.
// It used in the Insert method to merge constant children and parametric children
// into a single node when the MaxSplitThreshold is reached in a manner in which
// the paths they represent are still preserved.
// Terminal nodes data might be incorrect (but still preserved for the sake of successful lookups)
func convergeNodesPaths[T any](nodes []*Node[T]) *Node[T] {
	if len(nodes) == 0 {
		return &Node[T]{}
	}
	var sampleValue *T
	if nodes[0] != nil {
		sampleValue = nodes[0].Value
	}
	if len(nodes) == 1 {
		return nodes[0]
	}

	constantChildrenByPart := map[string][]*Node[T]{}
	parametricChildren := []ParametricChild[T]{}
	var wildcardChild *Node[T]

	for _, node := range nodes {
		if node == nil {
			continue
		}
		for part, child := range node.ConstantChildren {
			if _, found := constantChildrenByPart[part]; !found {
				constantChildrenByPart[part] = []*Node[T]{}
			}
			constantChildrenByPart[part] = append(
				constantChildrenByPart[part],
				child,
			)
		}

		if node.ParametricChild.Child != nil {
			parametricChildren = append(
				parametricChildren,
				node.ParametricChild,
			)
		}

		wildcardChild = node.WildcardChild
	}

	convergedConstantChildren := map[string]*Node[T]{}
	for part, nodes := range constantChildrenByPart {
		convergedConstantChildren[part] = convergeNodesPaths(nodes)
	}

	convergedParametricChild := ParametricChild[T]{}
	if len(parametricChildren) > 0 {
		childNodesToConverge := lo.Map(
			parametricChildren,
			func(pc ParametricChild[T], _ int) *Node[T] { return pc.Child },
		)
		names := lo.Map(
			parametricChildren,
			func(pc ParametricChild[T], _ int) string { return pc.Name },
		)
		sort.SliceStable(
			names,
			func(i, j int) bool { return names[i] < names[j] },
		)

		convergedParametricChild = ParametricChild[T]{
			Name:  names[0],
			Child: convergeNodesPaths(childNodesToConverge),
		}
	}

	return &Node[T]{
		Value:            sampleValue,
		ConstantChildren: convergedConstantChildren,
		ParametricChild:  convergedParametricChild,
		WildcardChild:    wildcardChild,
	}
}
