package redis_test

import (
	"lunar/toolkit-core/redis"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestItReturnsUnhashedPartsConcatenated(t *testing.T) {
	key := redis.NewKey().
		Append(redis.UnhashedKeyPart("lunar")).
		Append(redis.UnhashedKeyPart("policyA")).
		Append(redis.UnhashedKeyPart("counter"))
	res, err := key.Build("::")

	assert.Nil(t, err)
	assert.Equal(t, "lunar::policyA::counter", res)
}

func TestItReturnsKeyInCurlyBracesForAllHashedParts(t *testing.T) {
	key := redis.NewKey().
		Append(redis.HashedKeyPart("lunar")).
		Append(redis.HashedKeyPart("policyA")).
		Append(redis.HashedKeyPart("counter"))
	res, err := key.Build("::")

	assert.Nil(t, err)
	assert.Equal(t, "{lunar::policyA::counter}", res)
}

func TestItReturnsPartsInCurlyBracesForHashedParts(t *testing.T) {
	key := redis.NewKey().
		Append(redis.UnhashedKeyPart("lunar")).
		Append(redis.HashedKeyPart("policyA")).
		Append(redis.HashedKeyPart("config1")).
		Append(redis.UnhashedKeyPart("counter"))
	res, err := key.Build("::")

	assert.Nil(t, err)
	assert.Equal(t, "lunar::{policyA::config1}::counter", res)
}

func TestItReturnsPartsInCurlyBracesForHashedPartsWhenTheyStartKey(
	t *testing.T,
) {
	key := redis.NewKey().
		Append(redis.HashedKeyPart("lunar")).
		Append(redis.HashedKeyPart("policyA")).
		Append(redis.HashedKeyPart("config1")).
		Append(redis.UnhashedKeyPart("counter"))
	res, err := key.Build("::")

	assert.Nil(t, err)
	assert.Equal(t, "{lunar::policyA::config1}::counter", res)
}

func TestItReturnsPartsInCurlyBracesForHashedPartsWhenTheyEndKey(t *testing.T) {
	key := redis.NewKey().
		Append(redis.UnhashedKeyPart("lunar")).
		Append(redis.HashedKeyPart("policyA")).
		Append(redis.HashedKeyPart("config1")).
		Append(redis.HashedKeyPart("counter"))
	res, err := key.Build("::")

	assert.Nil(t, err)
	assert.Equal(t, "lunar::{policyA::config1::counter}", res)
}

func TestItReturnsErrorIfMoreThanOneSequenceOfHashedPartsSupplied(
	t *testing.T,
) {
	key := redis.NewKey().
		Append(redis.UnhashedKeyPart("lunar")).
		Append(redis.HashedKeyPart("policyA")).
		Append(redis.UnhashedKeyPart("config1")).
		Append(redis.HashedKeyPart("counter"))
	_, err := key.Build("::")

	assert.NotNil(t, err)
}

func TestItExtractHashTagFromRawKeyReturnsHashtag(t *testing.T) {
	rawKey := "my::{key::has}::curly::braces"
	got, err := redis.ExtractHashTagFromRawKey(rawKey)
	assert.Nil(t, err)
	want := redis.HashtagExtraction{Found: true, Hashtag: "key::has"}
	assert.Equal(t, want, got)
}

func TestItReturnsProperStructWhenNoHashTag(t *testing.T) {
	rawKey := "my::key::has::no::curly::braces"
	got, err := redis.ExtractHashTagFromRawKey(rawKey)
	assert.Nil(t, err)
	want := redis.HashtagExtraction{Found: false, Hashtag: ""}
	assert.Equal(t, want, got)
}

func TestItDisregardsUnclosedCurlyBraces(t *testing.T) {
	rawKey := "my::key::has::{partial::curly::braces"
	got, err := redis.ExtractHashTagFromRawKey(rawKey)
	assert.Nil(t, err)
	want := redis.HashtagExtraction{Found: false, Hashtag: ""}
	assert.Equal(t, want, got)
}

func TestItDisregardsFlippedCurlyBraces(t *testing.T) {
	rawKey := "my::key::has::}partial::{curly::braces"
	got, err := redis.ExtractHashTagFromRawKey(rawKey)
	assert.Nil(t, err)
	want := redis.HashtagExtraction{Found: false, Hashtag: ""}
	assert.Equal(t, want, got)
}

func TestItReturnsErrorIfMoreThanOneHashtagFound(t *testing.T) {
	rawKey := "my::key::has::{more}::{than::one}::hashtag"
	_, err := redis.ExtractHashTagFromRawKey(rawKey)
	assert.NotNil(t, err)
}

func TestMarshalKey(t *testing.T) {
	key := redis.NewKey().
		Append(redis.UnhashedKeyPart("lunar")).
		Append(redis.HashedKeyPart("policyA")).
		Append(redis.UnhashedKeyPart("counter"))

	marshalled, err := redis.MarshalKey(key)
	assert.Nil(t, err)
	assert.Equal(t, `[["lunar",false],["policyA",true],["counter",false]]`, marshalled)
}

func TestMarshalKeyEmptyKey(t *testing.T) {
	key := redis.NewKey()

	marshalled, err := redis.MarshalKey(key)
	assert.Nil(t, err)
	assert.Equal(t, `[]`, marshalled)
}

func TestUnmarshalKey(t *testing.T) {
	key := redis.NewKey().
		Append(redis.UnhashedKeyPart("lunar")).
		Append(redis.HashedKeyPart("policyA")).
		Append(redis.UnhashedKeyPart("counter"))

	marshalledKey, err := redis.MarshalKey(key)
	assert.Nil(t, err)

	key, err = redis.UnmarshalKey(marshalledKey)
	assert.Nil(t, err)
	expectedKey := redis.NewKey().
		Append(redis.UnhashedKeyPart("lunar")).
		Append(redis.HashedKeyPart("policyA")).
		Append(redis.UnhashedKeyPart("counter"))
	assert.Equal(t, expectedKey, key)
}

func TestUnmarshalKeyEmptyKey(t *testing.T) {
	marshalledKey := `[]`
	key, err := redis.UnmarshalKey(marshalledKey)
	assert.Nil(t, err)
	expectedKey := redis.NewKey()
	assert.Equal(t, expectedKey, key)
}

func TestUnmarshalKeyInvalidJSON(t *testing.T) {
	marshalledKey := `[["lunar",false],["policyA",true],["counter",false]`
	_, err := redis.UnmarshalKey(marshalledKey)
	assert.NotNil(t, err)
}
