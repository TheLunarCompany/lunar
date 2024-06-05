package urltree

import (
	"fmt"
)

func (urlTree *URLTree[T]) Insert(
	url string,
	value *T,
) error {
	err := validateURL(url)
	if err != nil {
		return err
	}

	splitURL := splitURL(url)
	currentNode := urlTree.Root
	for _, urlPart := range splitURL {
		if urlPart.Value == wildcard {
			currentNode.WildcardChild = &Node[T]{IsPartOfHost: urlPart.IsPartOfHost}
			currentNode = currentNode.WildcardChild
			continue
		}
		if paramName, isPathParam := TryExtractPathParameter(urlPart.Value); isPathParam {
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
					Child: &Node[T]{IsPartOfHost: urlPart.IsPartOfHost},
				}
			}
			currentNode = currentNode.ParametricChild.Child
			continue
		}
		if currentNode.ConstantChildren == nil {
			currentNode.ConstantChildren = map[string]*Node[T]{}
		}
		if _, found := currentNode.ConstantChildren[urlPart.Value]; !found {
			currentNode.ConstantChildren[urlPart.Value] = &Node[T]{IsPartOfHost: urlPart.IsPartOfHost}
		}
		currentNode = currentNode.ConstantChildren[urlPart.Value]
	}
	currentNode.Value = value

	return nil
}
