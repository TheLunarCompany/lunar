package logic_test

import (
	"lunar/toolkit-core/logic"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestItReturnsFalseWhenThereIsNoCommonDenominator(t *testing.T) {
	res := logic.HasCommonDenominator([]int{5, 6, 10})
	assert.False(t, res)
}

func TestItReturnsTrueWhenThereIsACommonDenominator(t *testing.T) {
	res := logic.HasCommonDenominator([]int{5, 100, 4005})
	assert.True(t, res)
}

func TestItReturnsTrueWhenThereIsOneNumber(t *testing.T) {
	res := logic.HasCommonDenominator([]int{7})
	assert.True(t, res)
}

func TestItReturnsFalseWhenSliceIsEmpty(t *testing.T) {
	res := logic.HasCommonDenominator([]int{})
	assert.False(t, res)
}
