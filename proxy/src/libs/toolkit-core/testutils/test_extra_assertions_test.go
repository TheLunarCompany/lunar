package testutils_test

import (
	"lunar/toolkit-core/testutils"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestEndsWithReturnsTrueWhenStringEndsWithOtherString(t *testing.T) {
	pred := testutils.EndsWith("foo-bar", "-bar")()
	assert.True(t, pred)
}

func TestEndsWithReturnsFalseWhenStringDoesntEndWithOtherString(t *testing.T) {
	pred := testutils.EndsWith("foo-bar", "-baz")()
	assert.False(t, pred)
}

func TestSliceAllEqualsReturnsTrueWhenSliceHasOnlyPassedItem(t *testing.T) {
	pred := testutils.SliceAllEquals([]int{1, 1}, 1)()
	assert.True(t, pred)
}

func TestSliceAllEqualsReturnsFalseWhenSliceHasPassedItemAndOtherItems(
	t *testing.T,
) {
	pred := testutils.SliceAllEquals([]int{1, 2}, 1)()
	assert.False(t, pred)
}

func TestSliceAllEqualsReturnsFalseWhenSliceHasAllSameValuesButPassedItemIsDifferent( //nolint:lll
	t *testing.T,
) {
	pred := testutils.SliceAllEquals([]int{1, 1}, 2)()
	assert.False(t, pred)
}

func TestSliceAllEqualsReturnsFalseWhenSliceIsEmptyAndZeroValueIsPassed(
	t *testing.T,
) {
	pred := testutils.SliceAllEquals([]int{}, 0)()
	assert.False(t, pred)
}
