package urltree

import (
	"fmt"
	"strings"
)

func (urlTree *URLTree[T]) Insert(
	url string,
	value *T,
) error {
	err := validateURL(url)
	if err != nil {
		return err
	}

	splitURL := strings.Split(url, "/")
	currentNode := urlTree.Root
	for _, urlPart := range splitURL {
		if urlPart == wildcard {
			currentNode.WildcardChild = &Node[T]{}
			currentNode = currentNode.WildcardChild
			continue
		}
		if paramName, isPathParam := TryExtractPathParameter(urlPart); isPathParam {
			if currentNode.ParametricChild.Child != nil {
				if paramName != currentNode.ParametricChild.Name {
					return fmt.Errorf(
						"Path parameter name '%v' does not match existing name '%v'",
						paramName,
						currentNode.ParametricChild.Name,
					)
				}
			} else {
				currentNode.ParametricChild = ParametricChild[T]{
					Name:  paramName,
					Child: &Node[T]{},
				}
			}
			currentNode = currentNode.ParametricChild.Child
			continue
		}
		if currentNode.ConstantChildren == nil {
			currentNode.ConstantChildren = map[string]*Node[T]{}
		}
		if _, found := currentNode.ConstantChildren[urlPart]; !found {
			currentNode.ConstantChildren[urlPart] = &Node[T]{}
		}
		currentNode = currentNode.ConstantChildren[urlPart]
	}
	currentNode.Value = value

	return nil
}
