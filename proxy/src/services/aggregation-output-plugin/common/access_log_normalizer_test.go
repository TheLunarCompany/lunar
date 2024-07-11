package common_test

import (
	"lunar/aggregation-plugin/common"
	"lunar/toolkit-core/urltree"
	"testing"

	"github.com/stretchr/testify/assert"
)

type DummyTree struct {
	insertErr    error
	lookupResult urltree.LookupResult[common.EmptyStruct]
}

func (tree DummyTree) Insert(_ string, _ *common.EmptyStruct) error {
	return tree.insertErr
}

func (tree DummyTree) InsertWithConvergenceIndication(
	_ string, _ *common.EmptyStruct,
) (bool, error) {
	return false, tree.insertErr
}

func (tree DummyTree) Lookup(
	_ string,
) urltree.LookupResult[common.EmptyStruct] {
	return tree.lookupResult
}

func TestNormalizeURLReturnsOriginalURLWhenURLNotMatchedByTree(t *testing.T) {
	t.Parallel()
	lookupResult := urltree.LookupResult[common.EmptyStruct]{
		Match: false,
	}
	tree := DummyTree{insertErr: nil, lookupResult: lookupResult}
	res := common.NormalizeURL(tree, "foo.com/50")
	want := "foo.com/50"
	assert.Equal(t, want, res)
}

func TestNormalizeURLReturnsNormalizedURLWhenURLMatchedByTree(t *testing.T) {
	t.Parallel()
	lookupResult := urltree.LookupResult[common.EmptyStruct]{
		Match:         true,
		NormalizedURL: "foo.com/{id}",
	}
	tree := DummyTree{insertErr: nil, lookupResult: lookupResult}
	res := common.NormalizeURL(tree, "foo.com/50")
	want := "foo.com/{id}"
	assert.Equal(t, want, res)
}

func TestStrictNormalizeURLReturnsNotFoundWhenURLNotMatchedByTree(
	t *testing.T,
) {
	t.Parallel()
	lookupResult := urltree.LookupResult[common.EmptyStruct]{
		Match: false,
	}
	tree := DummyTree{insertErr: nil, lookupResult: lookupResult}
	_, found := common.StrictNormalizeURL(tree, "foo.com/50")
	assert.Equal(t, false, found)
}

func TestStrictNormalizeURLReturnsFoundAndNormalizedURLWhenURLMatchedByTree(
	t *testing.T,
) {
	t.Parallel()
	lookupResult := urltree.LookupResult[common.EmptyStruct]{
		Match:         true,
		NormalizedURL: "foo.com/{id}",
	}
	tree := DummyTree{insertErr: nil, lookupResult: lookupResult}
	res, found := common.StrictNormalizeURL(tree, "foo.com/50")
	assert.Equal(t, true, found)
	want := "foo.com/{id}"
	assert.Equal(t, want, res)
}
