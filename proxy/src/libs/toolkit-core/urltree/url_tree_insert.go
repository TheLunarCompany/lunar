package urltree

import (
	"fmt"

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

func (urlTree *URLTree[T]) InsertDeclaredURL(
	url string,
	value *T,
) error {
	_, err := urlTree.insertWithConvergenceIndication(
		url,
		value,
		true,
	)
	return err
}

func (urlTree *URLTree[T]) InsertWithConvergenceIndication(
	url string,
	value *T,
) (bool, error) {
	return urlTree.insertWithConvergenceIndication(
		url,
		value,
		false,
	)
}

func (urlTree *URLTree[T]) insertWithConvergenceIndication(
	url string,
	value *T,
	declaredURL bool,
) (bool, error) {
	convergenceOccurred := false
	log.Trace().Msgf("Inserting %v into tree", url)
	err := validateURL(url)
	if err != nil {
		return convergenceOccurred, err
	}

	splitURL := splitURL(url)
	pathParamCount := 0
	currentNode := urlTree.Root

	for _, urlPart := range splitURL {
		// Handle wildcard first
		if urlPart.Value == wildcard {
			currentNode.WildcardChild = &Node[T]{
				IsPartOfHost: urlPart.IsPartOfHost,
			}
			currentNode = currentNode.WildcardChild
			log.Trace().Msgf("created wildcard child %v", urlPart.Value)
			continue
		}
		// Handle path params declaration
		if paramName, isPathParam := TryExtractPathParameter(urlPart.Value); isPathParam {
			if currentNode.ParametricChild.Child != nil {
				if paramName != currentNode.ParametricChild.Name {
					// unsupported case where a path parameter name does not match the existing one
					return convergenceOccurred, fmt.Errorf(
						"path parameter name '%v' does not match existing name '%v' in url '%v'",
						paramName,
						currentNode.ParametricChild.Name,
						url,
					)
				}
			} else {
				// if no parametric child exists, create one
				currentNode.ParametricChild = ParametricChild[T]{
					Name:  paramName,
					Child: &Node[T]{IsPartOfHost: urlPart.IsPartOfHost},
				}
				log.Trace().Str("original-url", url).Msgf("created explicit path parameter %v", paramName)
			}
			currentNode = currentNode.ParametricChild.Child
			continue
		}

		// make sure constant children map is initialized
		if currentNode.ConstantChildren == nil {
			currentNode.ConstantChildren = map[string]*Node[T]{}
		}

		// If matching constant child already exists, navigate into it
		if constantChild, constantFound := currentNode.ConstantChildren[urlPart.Value]; constantFound {
			currentNode = constantChild
			continue
		}

		// Preparation for convergence if needed
		currentConstantPathOnlyChildNodes := []*Node[T]{}
		currentConstantHostOnlyChildNodes := map[string]*Node[T]{}
		for part, child := range currentNode.ConstantChildren {
			if child.IsPartOfHost {
				currentConstantHostOnlyChildNodes[part] = child
			} else {
				currentConstantPathOnlyChildNodes = append(currentConstantPathOnlyChildNodes, child)
			}
		}

		isThresholdMet := len(currentConstantPathOnlyChildNodes) >= urlTree.maxSplitThreshold

		// Handle assumed path params if needed (before adding to ConstantChildren)
		if urlTree.assumedPathParamsEnabled && isThresholdMet {
			// Converge both children and parametric children
			pathParamCount++
			convergedChild := convergeNodesPaths(
				append(
					currentConstantPathOnlyChildNodes,
					currentNode.ParametricChild.Child,
				),
				pathParamCount,
			)
			convergenceOccurred = true
			log.Trace().Msgf("Tree was converged after %v", urlPart.Value)
			currentNode.ConstantChildren = currentConstantHostOnlyChildNodes

			// Create and assign a new parametric child (the converged node) on the current node
			currentNode.ParametricChild = ParametricChild[T]{
				Name: buildAssumedPathParamName(
					pathParamCount,
				),
				Child: convergedChild,
			}
			// Continue traversal into the newly converged node
			currentNode = currentNode.ParametricChild.Child
			continue
		}

		// Navigate into parametric child if it exists and not a declared URL
		if !declaredURL && currentNode.ParametricChild.Child != nil {
			log.Trace().
				Str("original-url", url).
				Msgf("Navigating into path param %v", currentNode.ParametricChild.Name)
			// We increment pathParamCount whether the parametric child is *assumed* or *declared*
			// in order to keep *ordinality* of path params in general. For example, we want to see
			// `twitter.com/user/{declaredPathParamForUserID}/comment/{_param_2}`
			// because the 2nd path param is, well, still the 2nd path param.
			pathParamCount++
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
func convergeNodesPaths[T any](nodes []*Node[T], paramIndex int) *Node[T] {
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
		convergedConstantChildren[part] = convergeNodesPaths(nodes, paramIndex)
	}

	convergedParametricChild := ParametricChild[T]{}
	if len(parametricChildren) > 0 {
		childNodesToConverge := lo.Map(
			parametricChildren,
			func(pc ParametricChild[T], _ int) *Node[T] { return pc.Child },
		)

		paramIndex++

		convergedParametricChild = ParametricChild[T]{
			Name:  buildAssumedPathParamName(paramIndex),
			Child: convergeNodesPaths(childNodesToConverge, paramIndex),
		}
	}

	return &Node[T]{
		Value:            sampleValue,
		ConstantChildren: convergedConstantChildren,
		ParametricChild:  convergedParametricChild,
		WildcardChild:    wildcardChild,
	}
}

func buildAssumedPathParamName(paramIndex int) string {
	return fmt.Sprintf("_param_%v", paramIndex)
}
