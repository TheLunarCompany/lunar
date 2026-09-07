package utils

// An implementation of the Semigroup pattern in Golang

func Combine[T Combinable[T]](a, b T) T {
	return a.Combine(b)
}

type Combinable[T any] interface {
	Combine(t2 T) T
}

type Map[K comparable, V Combinable[V]] map[K]V

func (mapA Map[K, V]) Combine(mapB Map[K, V]) Map[K, V] {
	res := make(map[K]V)

	for aKey, aValue := range mapA {
		res[aKey] = aValue
	}

	for bKey, bValue := range mapB {
		aValue, keyExists := res[bKey]
		if !keyExists {
			res[bKey] = bValue
			continue
		}
		res[bKey] = aValue.Combine(bValue)
	}

	return res
}
