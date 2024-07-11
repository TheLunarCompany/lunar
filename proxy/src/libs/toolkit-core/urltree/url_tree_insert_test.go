package urltree_test

import (
	"lunar/toolkit-core/urltree"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGivenConstantURLInsertIsSuccessful(t *testing.T) {
	t.Parallel()
	wantValue := &TestStruct{Data: 99999}
	urlTree := urltree.NewURLTree[TestStruct](false, 0)

	err := urlTree.Insert("twitter.com/user/1234", wantValue)
	assert.Nil(t, err)

	lookupResult := urlTree.Lookup("twitter.com/user/1234")

	assert.Equal(t, wantValue, lookupResult.Value)
}

func TestGivenWildcardURLInsertIsSuccessful(t *testing.T) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	urlTree := urltree.NewURLTree[TestStruct](false, 0)

	err := urlTree.Insert("twitter.com/user/*", wantValue)
	assert.Nil(t, err)

	lookupResult := urlTree.Lookup("twitter.com/user/blabla/hello")

	assert.Equal(t, wantValue, lookupResult.Value)
}

func TestGivenParametricURLInsertIsSuccessful(t *testing.T) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	urlTree := urltree.NewURLTree[TestStruct](false, 0)

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
	urlTree := urltree.NewURLTree[TestStruct](false, 0)

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
	urlTree := urltree.NewURLTree[TestStruct](false, 0)

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
	urlTree := urltree.NewURLTree[TestStruct](false, 0)

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
	urlTree := urltree.NewURLTree[TestStruct](false, 0)

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
	urlTree := urltree.NewURLTree[TestStruct](false, 0)

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
	urlTree := urltree.NewURLTree[TestStruct](false, 0)

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
	urlTree := urltree.NewURLTree[TestStruct](false, 0)
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
	urlTree := urltree.NewURLTree[TestStruct](false, 0)
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

func TestGivenPathParamInHostInsertIsSuccessful(
	t *testing.T,
) {
	t.Parallel()
	testValue := &TestStruct{Data: 456}
	urlTree := urltree.NewURLTree[TestStruct](false, 0)
	err := urlTree.Insert("{domain}.com/user/1234", testValue)
	assert.Nil(t, err)

	lookupResult := urlTree.Lookup("twitter.com/user/1234")
	assert.Equal(t, testValue, lookupResult.Value)
	assert.Equal(t, "{domain}.com/user/1234", lookupResult.NormalizedURL)
}

func TestGivenParametricPathInHostAndWildcardInPathInsertIsSuccessful(
	t *testing.T,
) {
	t.Parallel()
	testValue := &TestStruct{Data: 789}
	urlTree := urltree.NewURLTree[TestStruct](false, 0)
	err := urlTree.Insert("{otherDomain}.com/user/*", testValue)
	assert.Nil(t, err)

	lookupResult := urlTree.Lookup("twitter.com/user/1234")
	assert.Equal(t, testValue, lookupResult.Value)
	assert.Equal(t, "{otherDomain}.com/user/*", lookupResult.NormalizedURL)
}

func TestGivenParametricPathInHostAndInPathInsertIsSuccessful(
	t *testing.T,
) {
	t.Parallel()
	testValue := &TestStruct{Data: 101112}
	urlTree := urltree.NewURLTree[TestStruct](false, 0)
	err := urlTree.Insert("{domain}.com/user/{userID}", testValue)
	assert.Nil(t, err)

	lookupResult := urlTree.Lookup("twitter.com/user/1234")
	assert.Equal(t, testValue, lookupResult.Value)
	assert.Equal(t, "{domain}.com/user/{userID}", lookupResult.NormalizedURL)
}

func TestGivenWildcardInHostInsertIsSuccessful(
	t *testing.T,
) {
	t.Parallel()
	testValue := &TestStruct{Data: 131415}
	urlTree := urltree.NewURLTree[TestStruct](false, 0)
	err := urlTree.Insert("myip.*", testValue)
	assert.Nil(t, err)
	lookupResult := urlTree.Lookup("myip.wtf/json")
	assert.Equal(t, testValue, lookupResult.Value)
}

func TestAboveSplitThresholdAPathParamIsCreatedAnd(
	t *testing.T,
) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	makeWantParams := func(userID string) map[string]string {
		return map[string]string{"_param_1": userID}
	}
	urlTree := urltree.NewURLTree[TestStruct](true, 2)

	err := urlTree.Insert("twitter.com/user/1", wantValue)
	assert.Nil(t, err)
	err = urlTree.Insert("twitter.com/user/2", wantValue)
	assert.Nil(t, err)
	// Since the split threshold is 2, the next insert will create a path param
	err = urlTree.Insert("twitter.com/user/3", wantValue)
	assert.Nil(t, err)

	lookupResult3 := urlTree.Lookup("twitter.com/user/3")
	assert.True(t, lookupResult3.Match)
	assert.Equal(t, wantValue, lookupResult3.Value)
	assert.Equal(t, makeWantParams("3"), lookupResult3.PathParams)

	// Lookup will return a match even though 4 was not inserted explicitly
	lookupResult4 := urlTree.Lookup("twitter.com/user/4")
	assert.True(t, lookupResult4.Match)
	assert.Equal(t, wantValue, lookupResult4.Value)
	assert.Equal(t, makeWantParams("4"), lookupResult4.PathParams)
}

func TestAboveSplitThresholdAPathParamIsCreatedAlsoInMiddleOfUrl(
	t *testing.T,
) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	makeWantParams := func(userID string) map[string]string {
		return map[string]string{"_param_1": userID}
	}
	urlTree := urltree.NewURLTree[TestStruct](true, 2)

	err := urlTree.Insert("twitter.com/user/1/comment", wantValue)
	assert.Nil(t, err)
	err = urlTree.Insert("twitter.com/user/2/comment", wantValue)
	assert.Nil(t, err)
	// Since the split threshold is 2, the next insert will create a path param
	err = urlTree.Insert("twitter.com/user/3/comment", wantValue)
	assert.Nil(t, err)

	lookupResult3 := urlTree.Lookup("twitter.com/user/3/comment")
	assert.Equal(t, wantValue, lookupResult3.Value)
	assert.Equal(t, makeWantParams("3"), lookupResult3.PathParams)

	lookupResult4 := urlTree.Lookup("twitter.com/user/4/comment")
	assert.Equal(t, wantValue, lookupResult4.Value)
	assert.Equal(t, makeWantParams("4"), lookupResult4.PathParams)
}

func TestAboveSplitThresholdAPathParamIsCreatedAlsoInMiddleOfUrlWhenTheSplitHasANewChild(
	t *testing.T,
) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	makeWantParams := func(userID string) map[string]string {
		return map[string]string{"_param_1": userID}
	}
	urlTree := urltree.NewURLTree[TestStruct](true, 2)

	err := urlTree.Insert("twitter.com/user/1/comment", wantValue)
	assert.Nil(t, err)
	err = urlTree.Insert("twitter.com/user/2/comment", wantValue)
	assert.Nil(t, err)
	// Since the split threshold is 2, the next insert will create a path param
	err = urlTree.Insert("twitter.com/user/3/photos", wantValue)
	assert.Nil(t, err)

	lookupResult3 := urlTree.Lookup("twitter.com/user/6/comment")
	assert.Equal(t, wantValue, lookupResult3.Value)
	assert.Equal(t, makeWantParams("6"), lookupResult3.PathParams)

	lookupResult4 := urlTree.Lookup("twitter.com/user/4/photos")
	assert.Equal(t, wantValue, lookupResult4.Value)
	assert.Equal(t, makeWantParams("4"), lookupResult4.PathParams)
}

func TestAboveSplitThresholdAPathParamIsCreatedAndFormerConstantChildAreDeleted(
	t *testing.T,
) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	makeWantParams := func(userID string) map[string]string {
		return map[string]string{"_param_1": userID}
	}
	urlTree := urltree.NewURLTree[TestStruct](true, 2)

	err := urlTree.Insert("twitter.com/user/1/comment", wantValue)
	assert.Nil(t, err)
	lookupResult1 := urlTree.Lookup("twitter.com/user/1/comment")
	assert.True(t, lookupResult1.Match)
	assert.Equal(t, wantValue, lookupResult1.Value)
	assert.Nil(t, lookupResult1.PathParams)

	err = urlTree.Insert("twitter.com/user/2/comment", wantValue)
	assert.Nil(t, err)
	lookupResult2 := urlTree.Lookup("twitter.com/user/1/comment")
	assert.True(t, lookupResult2.Match)
	assert.Equal(t, wantValue, lookupResult2.Value)
	assert.Nil(t, lookupResult2.PathParams)

	// Since the split threshold is 2, the next insert will create a path param
	err = urlTree.Insert("twitter.com/user/3/comment", wantValue)
	assert.Nil(t, err)

	lookupResult1B := urlTree.Lookup("twitter.com/user/1/comment")
	assert.True(t, lookupResult1B.Match)
	assert.Equal(t, wantValue, lookupResult1B.Value)
	assert.Equal(t, makeWantParams("1"), lookupResult1B.PathParams)

	lookupResult2B := urlTree.Lookup("twitter.com/user/2/comment")
	assert.True(t, lookupResult2B.Match)
	assert.Equal(t, wantValue, lookupResult2B.Value)
	assert.Equal(t, makeWantParams("2"), lookupResult2B.PathParams)
}

func TestAboveSplitThresholdPathParamsNamedOrdinarily(t *testing.T) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	makeWantParams := func(userID string, commentID string) map[string]string {
		return map[string]string{"_param_1": userID, "_param_2": commentID}
	}
	urlTree := urltree.NewURLTree[TestStruct](true, 2)

	err := urlTree.Insert("twitter.com/user/1/comment/11", wantValue)
	assert.Nil(t, err)

	err = urlTree.Insert("twitter.com/user/2/comment/22", wantValue)
	assert.Nil(t, err)

	// Since the split threshold is 2, the next insert will create a path param
	err = urlTree.Insert("twitter.com/user/3/comment/33", wantValue)
	assert.Nil(t, err)

	lookupResult := urlTree.Lookup("twitter.com/user/5/comment/55")
	assert.True(t, lookupResult.Match)
	assert.Equal(t, wantValue, lookupResult.Value)
	assert.Equal(t, makeWantParams("5", "55"), lookupResult.PathParams)
}

func TestAboveSplitThresholdPathParamsNamedOrdinarilyEvenWhenConvergenceIsInTwoStages(
	t *testing.T,
) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	makeWantParams := func(userID string, commentID string) map[string]string {
		return map[string]string{"_param_1": userID, "_param_2": commentID}
	}
	urlTree := urltree.NewURLTree[TestStruct](true, 2)

	err := urlTree.Insert("twitter.com/user/1/comment/11", wantValue)
	assert.Nil(t, err)

	err = urlTree.Insert("twitter.com/user/2/comment/11", wantValue)
	assert.Nil(t, err)

	// Since the split threshold is 2, the next insert will create a path param
	err = urlTree.Insert("twitter.com/user/3/comment/22", wantValue)
	assert.Nil(t, err)

	// Since the split threshold is 2, the next insert will create a path param
	err = urlTree.Insert("twitter.com/user/4/comment/33", wantValue)
	assert.Nil(t, err)

	lookupResult := urlTree.Lookup("twitter.com/user/5/comment/55")
	assert.True(t, lookupResult.Match)
	assert.Equal(t, wantValue, lookupResult.Value)
	assert.Equal(t, makeWantParams("5", "55"), lookupResult.PathParams)
}

func TestAboveSplitThresholdConflictingParametricChildrenOfConvergedNodesAreResolvedByAlphabeticOrder(
	t *testing.T,
) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	makeWantParams := func(userID string, myParam string) map[string]string {
		return map[string]string{"_param_1": userID, "myOtherParam": myParam}
	}
	urlTree := urltree.NewURLTree[TestStruct](true, 2)

	err := urlTree.Insert("twitter.com/user/1/{myParam}/resourceA", wantValue)
	assert.Nil(t, err)

	err = urlTree.Insert(
		"twitter.com/user/2/{myOtherParam}/resourceB",
		wantValue,
	)
	assert.Nil(t, err)

	// Since the split threshold is 2, the next insert will create a path param
	err = urlTree.Insert("twitter.com/user/3/9/resourceA", wantValue)
	assert.Nil(t, err)

	lookupResult1 := urlTree.Lookup("twitter.com/user/5/dynamic/resourceA")
	assert.True(t, lookupResult1.Match)
	assert.Equal(t, wantValue, lookupResult1.Value)
	assert.Equal(t, makeWantParams("5", "dynamic"), lookupResult1.PathParams)

	lookupResult2 := urlTree.Lookup("twitter.com/user/6/dynamique/resourceB")
	assert.True(t, lookupResult2.Match)
	assert.Equal(t, wantValue, lookupResult2.Value)
	assert.Equal(t, makeWantParams("6", "dynamique"), lookupResult2.PathParams)
}

func TestAboveSplitThresholdPathParamsNamedOrdinarilyPerPath(t *testing.T) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	makeWantParams := func(userID string, commentID string) map[string]string {
		return map[string]string{"_param_1": userID, "_param_2": commentID}
	}
	urlTree := urltree.NewURLTree[TestStruct](true, 2)

	err := urlTree.Insert("twitter.com/user/1/comment/11", wantValue)
	assert.Nil(t, err)

	err = urlTree.Insert("twitter.com/user/2/comment/22", wantValue)
	assert.Nil(t, err)

	// Since the split threshold is 2, the next insert will create a path param
	err = urlTree.Insert("twitter.com/user/3/comment/33", wantValue)
	assert.Nil(t, err)

	err = urlTree.Insert("twitter.com/user/1/photo/101", wantValue)
	assert.Nil(t, err)
	err = urlTree.Insert("twitter.com/user/2/photo/202", wantValue)
	assert.Nil(t, err)

	// Since the split threshold is 2, the next insert will create a path param
	err = urlTree.Insert("twitter.com/user/3/photo/303", wantValue)
	assert.Nil(t, err)

	// by using the same helper, `makeWantParams`, we prove that on the same tree,
	// `_param_1` is retained for both (userID) and the next one is deterministically named `_param_2`
	lookupResult1 := urlTree.Lookup("twitter.com/user/5/comment/55")
	assert.True(t, lookupResult1.Match)
	assert.Equal(t, wantValue, lookupResult1.Value)
	assert.Equal(t, makeWantParams("5", "55"), lookupResult1.PathParams)

	lookupResult2 := urlTree.Lookup("twitter.com/user/5/photo/666")
	assert.True(t, lookupResult1.Match)
	assert.Equal(t, wantValue, lookupResult1.Value)
	assert.Equal(t, makeWantParams("5", "666"), lookupResult2.PathParams)
}

func TestAboveSplitThresholdLaterPartsBelowThresholdExistAsConstantParts(
	t *testing.T,
) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	makeWantParams := func(userID string) map[string]string {
		return map[string]string{"_param_1": userID}
	}
	urlTree := urltree.NewURLTree[TestStruct](true, 2)

	err := urlTree.Insert("twitter.com/user/1/comment/11", wantValue)
	assert.Nil(t, err)

	err = urlTree.Insert("twitter.com/user/1/comment/11", wantValue)
	assert.Nil(t, err)

	err = urlTree.Insert("twitter.com/user/2/comment/12", wantValue)
	assert.Nil(t, err)

	err = urlTree.Insert("twitter.com/user/2/comment/12", wantValue)
	assert.Nil(t, err)

	err = urlTree.Insert("twitter.com/user/3/comment/12", wantValue)
	assert.Nil(t, err)

	// Since the split threshold is 2, the part after `/user` is assumed as path param
	// however, the part after `/comment` is below the threshold and is assumed as constant
	lookupResult1 := urlTree.Lookup("twitter.com/user/5/comment/11")
	assert.True(t, lookupResult1.Match)
	assert.Equal(t, wantValue, lookupResult1.Value)
	assert.Equal(t, makeWantParams("5"), lookupResult1.PathParams)

	lookupResult2 := urlTree.Lookup("twitter.com/user/7/comment/12")
	assert.True(t, lookupResult2.Match)
	assert.Equal(t, wantValue, lookupResult2.Value)
	assert.Equal(t, makeWantParams("7"), lookupResult2.PathParams)

	// hence the following lookup will not match because the part after `/comment` is not assumed as path param
	// and `13` is not one of the constant values known on that split
	lookupResult3 := urlTree.Lookup("twitter.com/user/9/comment/13")
	assert.False(t, lookupResult3.Match)
}

func TestAboveSplitThresholdDeclaredPathParamNameIsPreserved(
	t *testing.T,
) {
	wantValue := &TestStruct{Data: 1}
	makeWantParams := func(userID string, commentID string) map[string]string {
		return map[string]string{"id": userID, "_param_2": commentID}
	}
	urlTree := urltree.NewURLTree[TestStruct](true, 2)

	// The `id` name would be preserved in extracted params
	err := urlTree.Insert("twitter.com/user/{id}", wantValue)
	assert.Nil(t, err)

	err = urlTree.Insert("twitter.com/user/1/comment/12", wantValue)
	assert.Nil(t, err)

	err = urlTree.Insert("twitter.com/user/2/comment/13", wantValue)
	assert.Nil(t, err)

	err = urlTree.Insert("twitter.com/user/3/comment/14", wantValue)
	assert.Nil(t, err)

	lookupResult1 := urlTree.Lookup("twitter.com/user/5/comment/15")
	assert.True(t, lookupResult1.Match)
	assert.Equal(t, wantValue, lookupResult1.Value)
	assert.Equal(t, makeWantParams("5", "15"), lookupResult1.PathParams)
}

func TestAboveSplitThresholdDeclaredPathParamNameIsPreservedEvenIfDivergedOnLatterPart(
	t *testing.T,
) {
	wantValue1 := &TestStruct{Data: 1}
	wantValue2 := &TestStruct{Data: 2}
	makeWantExplctParams := func(userID string, photoID string) map[string]string {
		return map[string]string{"id": userID, "photo_id": photoID}
	}
	makeWantAssumedParams := func(userID string, commentID string) map[string]string {
		return map[string]string{"id": userID, "_param_2": commentID}
	}
	urlTree := urltree.NewURLTree[TestStruct](true, 2)

	err := urlTree.Insert("twitter.com/user/{id}/photo/{photo_id}", wantValue1)
	assert.Nil(t, err)

	err = urlTree.Insert("twitter.com/user/1/comment/12", wantValue2)
	assert.Nil(t, err)

	err = urlTree.Insert("twitter.com/user/2/comment/13", wantValue2)
	assert.Nil(t, err)

	err = urlTree.Insert("twitter.com/user/3/comment/14", wantValue2)
	assert.Nil(t, err)

	lookupResult1 := urlTree.Lookup("twitter.com/user/5/photo/200")
	assert.True(t, lookupResult1.Match)
	assert.Equal(t, wantValue1, lookupResult1.Value)
	assert.Equal(t, makeWantExplctParams("5", "200"), lookupResult1.PathParams)

	lookupResult2 := urlTree.Lookup("twitter.com/user/5/comment/15")
	assert.True(t, lookupResult2.Match)
	assert.Equal(t, wantValue2, lookupResult2.Value)
	assert.Equal(t, makeWantAssumedParams("5", "15"), lookupResult2.PathParams)
}

func TestAboveSplitThresholdOnlyPathPartsAreConcerned(
	t *testing.T,
) {
	t.Parallel()
	wantValue := &TestStruct{Data: 1}
	urlTree := urltree.NewURLTree[TestStruct](true, 2)

	err := urlTree.Insert("twitter.co.fr/config", wantValue)
	assert.Nil(t, err)
	err = urlTree.Insert("twitter.co.il/config", wantValue)
	assert.Nil(t, err)
	err = urlTree.Insert("twitter.co.uk/config", wantValue)
	assert.Nil(t, err)

	lookupResult1 := urlTree.Lookup("twitter.co.hr2/config")
	assert.False(t, lookupResult1.Match)
}

func TestAboveSplitThresholdHostPartsAreNotLostIfNextPartBecomesParametricByPath(
	t *testing.T,
) {
	t.Parallel()
	wantValue1 := &TestStruct{Data: 1}
	wantValue2 := &TestStruct{Data: 2}
	urlTree := urltree.NewURLTree[TestStruct](true, 2)

	err := urlTree.Insert("twitter.co.fr/config", wantValue1)
	assert.Nil(t, err)
	err = urlTree.Insert("twitter.co/1/config", wantValue2)
	assert.Nil(t, err)
	err = urlTree.Insert("twitter.co/2/config", wantValue2)
	assert.Nil(t, err)
	err = urlTree.Insert("twitter.co/3/config", wantValue2)
	assert.Nil(t, err)

	lookupResult := urlTree.Lookup("twitter.co.fr/config")
	assert.True(t, lookupResult.Match)
	assert.Equal(t, wantValue1, lookupResult.Value)
	assert.Nil(t, lookupResult.PathParams)
}

func TestAboveSplitThresholdParamsAreAssumedEvenWhenHostPartIsPreservedAsConstant(
	t *testing.T,
) {
	t.Parallel()
	makeWantParams := func(id string) map[string]string {
		return map[string]string{"_param_1": id}
	}
	wantValue1 := &TestStruct{Data: 1}
	wantValue2 := &TestStruct{Data: 2}
	urlTree := urltree.NewURLTree[TestStruct](true, 2)

	err := urlTree.Insert("twitter.co.fr/config", wantValue1)
	assert.Nil(t, err)
	err = urlTree.Insert("twitter.co/1/config", wantValue2)
	assert.Nil(t, err)
	err = urlTree.Insert("twitter.co/2/config", wantValue2)
	assert.Nil(t, err)
	err = urlTree.Insert("twitter.co/3/config", wantValue2)
	assert.Nil(t, err)

	lookupResult := urlTree.Lookup("twitter.co/6/config")
	assert.True(t, lookupResult.Match)
	assert.Equal(t, wantValue2, lookupResult.Value)
	assert.Equal(t, makeWantParams("6"), lookupResult.PathParams)
}

func TestAboveSplitThresholdWildcardChildIsPreservedInConvergedNode(
	t *testing.T,
) {
	t.Parallel()
	wantValue1 := &TestStruct{Data: 1}
	wantValue2 := &TestStruct{Data: 2}
	makeWantParams := func(userID string) map[string]string {
		return map[string]string{"_param_1": userID}
	}
	urlTree := urltree.NewURLTree[TestStruct](true, 2)

	err := urlTree.Insert("twitter.com/user/1/config", wantValue1)
	assert.Nil(t, err)

	err = urlTree.Insert("twitter.com/user/2/config", wantValue1)
	assert.Nil(t, err)

	// Since the split threshold is 2, the next insert will create a path param
	err = urlTree.Insert("twitter.com/user/3/*", wantValue2)
	assert.Nil(t, err)

	lookupResult1 := urlTree.Lookup("twitter.com/user/5/config")
	assert.True(t, lookupResult1.Match)
	assert.Equal(t, wantValue1, lookupResult1.Value)
	assert.Equal(t, makeWantParams("5"), lookupResult1.PathParams)

	lookupResult2 := urlTree.Lookup("twitter.com/user/5/unseen")
	assert.True(t, lookupResult2.Match)
	assert.Equal(t, wantValue2, lookupResult2.Value)
	assert.Equal(t, makeWantParams("5"), lookupResult2.PathParams)
}
