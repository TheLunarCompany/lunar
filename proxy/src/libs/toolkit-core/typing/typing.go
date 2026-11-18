package typing

import "fmt"

// Function to facilitate the common pattern of ensuring a pointer
// is defined and working with the result, if defined
func PtrIfDefined[T any](t *T) (*T, bool) {
	if t != nil {
		return t, true
	}
	return nil, false
}

// Function to support work with tagged union types,
// which are not natively supported in Go.
// @param enum: a pointer to the tag's enum value.
// @param unassignedValue: the enum value which represents a yet-untagged union.
// @param mappable: an implementer of the `Mappable` interface, required for
// extracting the right tag per invocation.
//
// This function has no return value - it might mutate the supplied pointer
// to `enum` in case tagging is required.
func EnsureTag[Enum comparable](
	enum *Enum,
	unassignedValue Enum,
	mapFunction func() []UnionMemberPresence[Enum],
) error {
	if *enum != unassignedValue {
		return nil
	}
	valueToSet := unassignedValue
	mapping := mapFunction()
	for _, presence := range mapping {
		if !presence.Defined {
			continue
		}
		if valueToSet == unassignedValue {
			valueToSet = presence.Value
			continue
		}
		return fmt.Errorf(
			"multiple members defined in union type (%+v), will not tag union",
			mapping,
		)
	}
	if valueToSet == unassignedValue {
		return fmt.Errorf(
			"no member defined in union type (%+v), will not tag union",
			mapping,
		)
	}
	*enum = valueToSet
	return nil
}

// Utility struct that represents whether a pointer is defined
// and the tag value to use in case it is defined.
type UnionMemberPresence[V any] struct {
	Defined bool
	Value   V
}

// Function to assist with matching expected signatures.
// For example, `lo.Map` require a mapper function which has a second
// `index int` parameter, which is often not present in pre-existing functions
// usage example:
//
// m := utils.WithArg[int](strings.ToLower)
// values = lo.Map(rawValues, m)
func WithArg[X any, A any, B any](f func(A) B) func(A, X) B {
	return func(a A, _ X) B {
		return f(a)
	}
}
