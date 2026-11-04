package urltree_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGivenConstantEndpointURLTreeLookupReturnsResult(t *testing.T) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	urlTree := constantURLTree(wantValue)
	lookupResult := urlTree.Lookup("twitter.com/user/1234")

	assert.Equal(t, wantValue, lookupResult.Value)
}

func TestGivenWildcardEndpointURLTreeLookupReturnsResult(t *testing.T) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	urlTree := wildcardURLTree(wantValue)
	lookupResult := urlTree.Lookup("twitter.com/user/1234/messages")

	assert.Equal(t, wantValue, lookupResult.Value)
}

func TestGivenWildcardEndpointURLTreeLookupReturnsNormalizedURL(t *testing.T) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	urlTree := wildcardURLTree(wantValue)
	lookupResult := urlTree.Lookup("twitter.com/user/1234/messages")

	assert.Equal(t, "twitter.com/user/*", lookupResult.NormalizedURL)
}

func TestGivenPrefixMatchingWildcardEndpointURLTreeLookupReturnsResult(
	t *testing.T,
) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	urlTree := wildcardURLTree(wantValue)
	lookupResult := urlTree.Lookup("twitter.com/user")

	assert.Equal(t, wantValue, lookupResult.Value)
}

func TestGivenPathParamEndpointURLTreeLookupReturnsResult(t *testing.T) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	urlTree := pathParamURLTree(wantValue)

	lookupResult := urlTree.Lookup("twitter.com/user/1234")

	wantParams := map[string]string{"userID": "1234"}
	assert.Equal(t, wantValue, lookupResult.Value)
	assert.Equal(t, wantParams, lookupResult.PathParams)
}

func TestGivenPathParamEndpointURLTreeLookupPathParamReturnsResult(
	t *testing.T,
) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	urlTree := pathParamURLTree(wantValue)

	lookupResult := urlTree.Lookup("twitter.com/user/{userID}")

	assert.Equal(t, wantValue, lookupResult.Value)
	assert.Nil(t, lookupResult.PathParams)
}

func TestGivenPathParamEndpointURLTreeLookupPathParamWithDifferentNameReturnsResult(
	t *testing.T,
) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	urlTree := pathParamURLTree(wantValue)

	lookupResult := urlTree.Lookup("twitter.com/user/{uid}")

	assert.Equal(t, wantValue, lookupResult.Value)
	assert.Nil(t, lookupResult.PathParams)
}

func TestGivenMixedEndpointURLTreeLookupReturnsResult(t *testing.T) {
	t.Parallel()
	wantConstantValue := &TestStruct{Data: 999}
	wantWildcardValue := &TestStruct{Data: 888}
	urlTree := mixedURLTree(wantConstantValue, wantWildcardValue)

	lookupResult1 := urlTree.Lookup("twitter.com/user/1234/messages")

	lookupResult2 := urlTree.Lookup("twitter.com/user/1234/messages/5678")

	assert.Equal(t, wantConstantValue, lookupResult1.Value)
	assert.Equal(t, wantWildcardValue, lookupResult2.Value)
}

func TestGivenUnmatchedConstantEndpointURLTreeLookupReturnsNilResult(
	t *testing.T,
) {
	t.Parallel()
	testValue := &TestStruct{Data: 1}
	urlTree := constantURLTree(testValue)

	lookupResult := urlTree.Lookup("twitter.com/user/foobar")

	assert.Nil(t, lookupResult.Value)
}

func TestGivenConstantEndpointURLTreePathParameterLookupReturnsNilResult(
	t *testing.T,
) {
	t.Parallel()
	testValue := &TestStruct{Data: 1}
	urlTree := constantURLTree(testValue)

	lookupResult := urlTree.Lookup("twitter.com/user/{userID}")

	assert.Nil(t, lookupResult.Value)
}

func TestGivenUnmatchedWildcardEndpointURLTreeLookupReturnsNilResult(
	t *testing.T,
) {
	t.Parallel()
	testValue := &TestStruct{Data: 1}
	urlTree := wildcardURLTree(testValue)

	lookupResult := urlTree.Lookup("twitter.com/post/1234")

	assert.Nil(t, lookupResult.Value)
}

func TestGivenUnmatchedPathParamEndpointURLTreeLookupReturnsNilResult(
	t *testing.T,
) {
	t.Parallel()
	testValue := &TestStruct{Data: 1}
	urlTree := pathParamURLTree(testValue)

	lookupResult := urlTree.Lookup("twitter.com/user/1234/messages")

	assert.Nil(t, lookupResult.Value)
	assert.Nil(t, lookupResult.PathParams)
}

func TestGivenUnmatchedMixedEndpointURLTreeLookupReturnsResult(t *testing.T) {
	t.Parallel()
	wantConstantValue := &TestStruct{Data: 999}
	wantWildcardValue := &TestStruct{Data: 888}
	urlTree := mixedURLTree(wantConstantValue, wantWildcardValue)

	lookupResult := urlTree.Lookup("twitter.com/post/1234/messages")

	assert.Nil(t, lookupResult.Value)
}

func TestGivenWildcardInHostURLTreeLookupReturnsResult(t *testing.T) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	urlTree := parametricPathInHostURLTree(wantValue)

	lookupResult := urlTree.Lookup("twitter.com/user/1234/messages")

	assert.Equal(t, wantValue, lookupResult.Value)
	assert.Equal(t, "{host}.com/user/1234/*", lookupResult.NormalizedURL)
}

func TestHostIsNotConfusedWithPath(t *testing.T) {
	t.Parallel()
	wantValue := &TestStruct{Data: 2}
	urlTree := parametricPathInHostURLTree(wantValue)

	lookupResult := urlTree.Lookup("twitter/com/user/1234/messages")

	assert.Nil(t, lookupResult.Value)
}
