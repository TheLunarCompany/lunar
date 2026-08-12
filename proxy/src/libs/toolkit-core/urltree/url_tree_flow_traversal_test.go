package urltree_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGivenConstantEndpointURLTreeFlowTraversalReturnsResult(t *testing.T) {
	t.Parallel()
	value := TestStruct{Data: 1}
	wantValue := []TestStruct{value}
	urlTree := constantURLTree(&value)
	lookupResult := urlTree.Traversal("twitter.com/user/1234")

	assert.Equal(t, wantValue, lookupResult.Value)
}

func TestGivenWildcardEndpointURLTreeFlowTraversalReturnsResult(t *testing.T) {
	t.Parallel()
	value := TestStruct{Data: 1}
	value2 := TestStruct{Data: 2}
	wantValue := []TestStruct{value, value2}
	urlTree := FlowsWithWildcardAtStartURLTree(&value, &value2)
	lookupResult := urlTree.Traversal("twitter.com/user")

	assert.Equal(t, wantValue, lookupResult.Value)
}
