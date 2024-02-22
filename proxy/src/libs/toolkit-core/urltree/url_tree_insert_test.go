package urltree_test

import (
	"lunar/toolkit-core/urltree"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGivenConstantURLInsertIsSuccessful(t *testing.T) {
	t.Parallel()
	wantValue := &TestStruct{Data: 99999}
	urlTree := urltree.NewURLTree[TestStruct]()

	err := urlTree.Insert("twitter.com/user/1234", wantValue)
	assert.Nil(t, err)

	lookupResult := urlTree.Lookup("twitter.com/user/1234")

	assert.Equal(t, wantValue, lookupResult.Value)
}

func TestGivenWildcardURLInsertIsSuccessful(t *testing.T) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	urlTree := urltree.NewURLTree[TestStruct]()

	err := urlTree.Insert("twitter.com/user/*", wantValue)
	assert.Nil(t, err)

	lookupResult := urlTree.Lookup("twitter.com/user/blabla/hello")

	assert.Equal(t, wantValue, lookupResult.Value)
}

func TestGivenParametricURLInsertIsSuccessful(t *testing.T) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	urlTree := urltree.NewURLTree[TestStruct]()

	err := urlTree.Insert("twitter.com/user/{userID}", wantValue)
	assert.Nil(t, err)

	lookupResult := urlTree.Lookup("twitter.com/user/999")

	wantParams := map[string]string{"userID": "999"}
	assert.Equal(t, wantValue, lookupResult.Value)
	assert.Equal(t, wantParams, lookupResult.PathParams)
}

func TestGivenConstantURLIsInTreeParametricURLInsertIsSuccessful(t *testing.T) {
	t.Parallel()
	wantExactMatchValue := &TestStruct{Data: 1}
	wantParametricPathValue := &TestStruct{Data: 2}
	urlTree := urltree.NewURLTree[TestStruct]()

	err := urlTree.Insert("twitter.com/user/1234", wantExactMatchValue)
	assert.Nil(t, err)

	err = urlTree.Insert("twitter.com/user/{userID}", wantParametricPathValue)
	assert.Nil(t, err)

	lookupExactMatchResult := urlTree.Lookup("twitter.com/user/1234")
	lookupPathParameterResult := urlTree.Lookup("twitter.com/user/999")

	wantParams := map[string]string{"userID": "999"}
	assert.Equal(t, wantExactMatchValue, lookupExactMatchResult.Value)
	assert.Nil(t, lookupExactMatchResult.PathParams)
	assert.Equal(t, wantParametricPathValue, lookupPathParameterResult.Value)
	assert.Equal(t, wantParams, lookupPathParameterResult.PathParams)
}

func TestGivenParametricURLIsInTreePathParameterInsertIsSuccessful(
	t *testing.T,
) {
	t.Parallel()
	wantValue1 := &TestStruct{Data: 1}
	wantValue2 := &TestStruct{Data: 2}
	urlTree := urltree.NewURLTree[TestStruct]()

	err := urlTree.Insert("twitter.com/user/{userID}", wantValue1)
	assert.Nil(t, err)

	lookupResult1 := urlTree.Lookup("twitter.com/user/999")

	err = urlTree.Insert("twitter.com/user/{userID}", wantValue2)
	assert.Nil(t, err)

	lookupResult2 := urlTree.Lookup("twitter.com/user/999")

	wantParams := map[string]string{"userID": "999"}
	assert.Equal(t, wantValue1, lookupResult1.Value)
	assert.Equal(t, wantParams, lookupResult2.PathParams)
	assert.Equal(t, wantValue2, lookupResult2.Value)
	assert.Equal(t, wantParams, lookupResult2.PathParams)
}

func TestGivenParametricURLIsInTreeConstantChildInsertIsSuccessful(
	t *testing.T,
) {
	t.Parallel()
	wantParametricPathValue := &TestStruct{Data: 1}
	wantExactMatchValue := &TestStruct{Data: 2}
	urlTree := urltree.NewURLTree[TestStruct]()

	err := urlTree.Insert("twitter.com/user/{userID}", wantParametricPathValue)
	assert.Nil(t, err)

	lookupResult1 := urlTree.Lookup("twitter.com/user/1234")

	err = urlTree.Insert("twitter.com/user/1234", wantExactMatchValue)
	assert.Nil(t, err)

	lookupResult2 := urlTree.Lookup("twitter.com/user/1234")

	wantParams := map[string]string{"userID": "1234"}
	assert.Equal(t, wantParametricPathValue, lookupResult1.Value)
	assert.Equal(t, wantParams, lookupResult1.PathParams)
	assert.Equal(t, wantExactMatchValue, lookupResult2.Value)
	assert.Nil(t, lookupResult2.PathParams)
}

func TestGivenParametricURLIsInTreeParametricURLWithDifferentParamNameInsertReturnsError(
	t *testing.T,
) {
	t.Parallel()
	wantValue1 := &TestStruct{Data: 1}
	wantValue2 := &TestStruct{Data: 2}
	urlTree := urltree.NewURLTree[TestStruct]()

	err := urlTree.Insert("twitter.com/user/{userID}", wantValue1)
	assert.Nil(t, err)

	lookupResult1 := urlTree.Lookup("twitter.com/user/1234")

	err = urlTree.Insert("twitter.com/user/{uid}", wantValue2)
	assert.NotNil(t, err)

	lookupResult2 := urlTree.Lookup("twitter.com/user/1234")

	wantParams := map[string]string{"userID": "1234"}
	assert.Equal(t, wantValue1, lookupResult1.Value)
	assert.Equal(t, wantParams, lookupResult1.PathParams)
	assert.Equal(t, wantValue1, lookupResult2.Value)
	assert.Equal(t, wantParams, lookupResult1.PathParams)
}

func TestGivenMixedURLsInsertIsSuccessful(t *testing.T) {
	t.Parallel()
	wantExactMatchValue := &TestStruct{Data: 1}
	wantWildcardMatchValue := &TestStruct{Data: 2}
	wantPathParamMatchValue := &TestStruct{Data: 3}
	urlTree := urltree.NewURLTree[TestStruct]()

	err := urlTree.Insert(
		"twitter.com/user/1234", wantExactMatchValue)
	assert.Nil(t, err)
	lookupResult1 := urlTree.Lookup("twitter.com/user/1234")
	assert.Equal(t, wantExactMatchValue, lookupResult1.Value)

	lookupResult2 := urlTree.Lookup("twitter.com/user/999")
	assert.Nil(t, lookupResult2.Value)

	err = urlTree.Insert(
		"twitter.com/user/*", wantWildcardMatchValue)
	assert.Nil(t, err)
	lookupResult3 := urlTree.Lookup("twitter.com/user/1234")
	assert.Equal(t, wantExactMatchValue, lookupResult3.Value)

	lookupResult4 := urlTree.Lookup("twitter.com/user/1234/messages")
	assert.Equal(t, wantWildcardMatchValue, lookupResult4.Value)

	lookupResult5 := urlTree.Lookup("twitter.com/user/999")
	assert.Equal(t, wantWildcardMatchValue, lookupResult5.Value)

	lookupResult6 := urlTree.Lookup("twitter.com/post/1234")
	assert.Nil(t, lookupResult6.Value)

	err = urlTree.Insert(
		"twitter.com/user/{userID}", wantPathParamMatchValue)
	assert.Nil(t, err)

	lookupResult7 := urlTree.Lookup("twitter.com/user/1234")
	assert.Equal(t, wantExactMatchValue, lookupResult7.Value)

	lookupResult10 := urlTree.Lookup("twitter.com/user/1234/messages")
	assert.Equal(t, wantWildcardMatchValue, lookupResult10.Value)

	lookupResult11 := urlTree.Lookup("twitter.com/user/999")
	wantParams := map[string]string{"userID": "999"}
	assert.Equal(t, wantPathParamMatchValue, lookupResult11.Value)
	assert.Equal(
		t,
		wantParams,
		lookupResult11.PathParams,
	)

	lookupResult12 := urlTree.Lookup("twitter.com/post/1234")
	assert.Nil(t, lookupResult12.Value)
}

func TestGivenWildcardAndPathParameterURLPathParameterIsMatched(
	t *testing.T,
) {
	t.Parallel()
	wantWildcardValue := &TestStruct{Data: 1}
	wantParametricPathValue := &TestStruct{Data: 2}
	urlTree := urltree.NewURLTree[TestStruct]()

	err := urlTree.Insert("twitter.com/user/*", wantWildcardValue)
	assert.Nil(t, err)
	err = urlTree.Insert("twitter.com/user/{userID}", wantParametricPathValue)
	assert.Nil(t, err)

	lookupResult := urlTree.Lookup("twitter.com/user/999")

	wantParams := map[string]string{"userID": "999"}
	assert.Equal(t, wantParametricPathValue, lookupResult.Value)
	assert.Equal(t, wantParams, lookupResult.PathParams)
}

func TestGivenDuplicateURLsInsertIsSuccessful(
	t *testing.T,
) {
	t.Parallel()
	testValue := &TestStruct{Data: 99999}
	urlTree := urltree.NewURLTree[TestStruct]()
	err := urlTree.Insert("twitter.com/user/1234", testValue)
	assert.Nil(t, err)
	err = urlTree.Insert("twitter.com/user/1234", testValue)
	assert.Nil(t, err)
}

func TestGivenOverlappingURLsInsertIsSuccessful(
	t *testing.T,
) {
	t.Parallel()
	testValue := &TestStruct{Data: 99999}
	urlTree := urltree.NewURLTree[TestStruct]()
	err := urlTree.Insert("twitter.com/user/1234", testValue)
	assert.Nil(t, err)
	err = urlTree.Insert(
		"twitter.com/user/{userID}", testValue)
	assert.Nil(t, err)
	err = urlTree.Insert("twitter.com/user/*", testValue)
	assert.Nil(t, err)
	err = urlTree.Insert("twitter.com/*", testValue)
	assert.Nil(t, err)
}
