package testutils

import (
	"strings"

	"github.com/samber/lo"
)

// This file contains extensions to testify's built-in assertions.
// It is meant to be used only in tests, like this:
// assert.Condition(t, utils.EndsWith("foobar", "bar"))

// A condition that asserts that a strings ends with a certain suffix.
func EndsWith(s string, suffix string) func() bool {
	return func() bool { return strings.HasSuffix(s, suffix) }
}

// A condition that asserts that a slice only contains a single item,
// which is the second argument to the condition.
func SliceAllEquals[T comparable](slice []T, item T) func() bool {
	return func() bool {
		if len(slice) == 0 {
			return false
		}
		return lo.Every([]T{item}, slice)
	}
}
