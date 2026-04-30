package urltree

type Method string

type EndpointTree[T any] struct{ URLTree[map[Method]T] }

func NewEndpointTree[T any]() *EndpointTree[T] {
	return &EndpointTree[T]{
		URLTree[map[Method]T]{
			Root: &Node[map[Method]T]{},
		},
	}
}
