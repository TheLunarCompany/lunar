package lunarredisclient_test

import (
	lunarRedisClient "lunar/toolkit-core/redis-client"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestItReturnsUnhashedPartsConcatenated(t *testing.T) {
	key := lunarRedisClient.NewKey().
		Append(lunarRedisClient.UnhashedKeyPart("lunar")).
		Append(lunarRedisClient.UnhashedKeyPart("policyA")).
		Append(lunarRedisClient.UnhashedKeyPart("counter"))
	res, err := key.Build("::")

	assert.Nil(t, err)
	assert.Equal(t, "lunar::policyA::counter", res)
}

func TestItReturnsKeyInCurlyBracesForAllHashedParts(t *testing.T) {
	key := lunarRedisClient.NewKey().
		Append(lunarRedisClient.HashedKeyPart("lunar")).
		Append(lunarRedisClient.HashedKeyPart("policyA")).
		Append(lunarRedisClient.HashedKeyPart("counter"))
	res, err := key.Build("::")

	assert.Nil(t, err)
	assert.Equal(t, "{lunar::policyA::counter}", res)
}

func TestItReturnsPartsInCurlyBracesForHashedParts(t *testing.T) {
	key := lunarRedisClient.NewKey().
		Append(lunarRedisClient.UnhashedKeyPart("lunar")).
		Append(lunarRedisClient.HashedKeyPart("policyA")).
		Append(lunarRedisClient.HashedKeyPart("config1")).
		Append(lunarRedisClient.UnhashedKeyPart("counter"))
	res, err := key.Build("::")

	assert.Nil(t, err)
	assert.Equal(t, "lunar::{policyA::config1}::counter", res)
}

func TestItReturnsPartsInCurlyBracesForHashedPartsWhenTheyStartKey(
	t *testing.T,
) {
	key := lunarRedisClient.NewKey().
		Append(lunarRedisClient.HashedKeyPart("lunar")).
		Append(lunarRedisClient.HashedKeyPart("policyA")).
		Append(lunarRedisClient.HashedKeyPart("config1")).
		Append(lunarRedisClient.UnhashedKeyPart("counter"))
	res, err := key.Build("::")

	assert.Nil(t, err)
	assert.Equal(t, "{lunar::policyA::config1}::counter", res)
}

func TestItReturnsPartsInCurlyBracesForHashedPartsWhenTheyEndKey(t *testing.T) {
	key := lunarRedisClient.NewKey().
		Append(lunarRedisClient.UnhashedKeyPart("lunar")).
		Append(lunarRedisClient.HashedKeyPart("policyA")).
		Append(lunarRedisClient.HashedKeyPart("config1")).
		Append(lunarRedisClient.HashedKeyPart("counter"))
	res, err := key.Build("::")

	assert.Nil(t, err)
	assert.Equal(t, "lunar::{policyA::config1::counter}", res)
}

func TestItReturnsErrorIfMoreThanOneSequenceOfHashedPartsSupplied(
	t *testing.T,
) {
	key := lunarRedisClient.NewKey().
		Append(lunarRedisClient.UnhashedKeyPart("lunar")).
		Append(lunarRedisClient.HashedKeyPart("policyA")).
		Append(lunarRedisClient.UnhashedKeyPart("config1")).
		Append(lunarRedisClient.HashedKeyPart("counter"))
	_, err := key.Build("::")

	assert.NotNil(t, err)
}

func TestItExtractHashTagFromRawKeyReturnsHashtag(t *testing.T) {
	rawKey := "my::{key::has}::curly::braces"
	got, err := lunarRedisClient.ExtractHashTagFromRawKey(rawKey)
	assert.Nil(t, err)
	want := lunarRedisClient.HashtagExtraction{Found: true, Hashtag: "key::has"}
	assert.Equal(t, want, got)
}

func TestItReturnsProperStructWhenNoHashTag(t *testing.T) {
	rawKey := "my::key::has::no::curly::braces"
	got, err := lunarRedisClient.ExtractHashTagFromRawKey(rawKey)
	assert.Nil(t, err)
	want := lunarRedisClient.HashtagExtraction{Found: false, Hashtag: ""}
	assert.Equal(t, want, got)
}

func TestItDisregardsUnclosedCurlyBraces(t *testing.T) {
	rawKey := "my::key::has::{partial::curly::braces"
	got, err := lunarRedisClient.ExtractHashTagFromRawKey(rawKey)
	assert.Nil(t, err)
	want := lunarRedisClient.HashtagExtraction{Found: false, Hashtag: ""}
	assert.Equal(t, want, got)
}

func TestItDisregardsFlippedCurlyBraces(t *testing.T) {
	rawKey := "my::key::has::}partial::{curly::braces"
	got, err := lunarRedisClient.ExtractHashTagFromRawKey(rawKey)
	assert.Nil(t, err)
	want := lunarRedisClient.HashtagExtraction{Found: false, Hashtag: ""}
	assert.Equal(t, want, got)
}

func TestItReturnsErrorIfMoreThanOneHashtagFound(t *testing.T) {
	rawKey := "my::key::has::{more}::{than::one}::hashtag"
	_, err := lunarRedisClient.ExtractHashTagFromRawKey(rawKey)
	assert.NotNil(t, err)
}

func TestMarshalKey(t *testing.T) {
	key := lunarRedisClient.NewKey().
		Append(lunarRedisClient.UnhashedKeyPart("lunar")).
		Append(lunarRedisClient.HashedKeyPart("policyA")).
		Append(lunarRedisClient.UnhashedKeyPart("counter"))

	marshalled, err := lunarRedisClient.MarshalKey(key)
	assert.Nil(t, err)
	assert.Equal(t, `[["lunar",false],["policyA",true],["counter",false]]`, marshalled)
}

func TestMarshalKeyEmptyKey(t *testing.T) {
	key := lunarRedisClient.NewKey()

	marshalled, err := lunarRedisClient.MarshalKey(key)
	assert.Nil(t, err)
	assert.Equal(t, `[]`, marshalled)
}

func TestUnmarshalKey(t *testing.T) {
	key := lunarRedisClient.NewKey().
		Append(lunarRedisClient.UnhashedKeyPart("lunar")).
		Append(lunarRedisClient.HashedKeyPart("policyA")).
		Append(lunarRedisClient.UnhashedKeyPart("counter"))

	marshalledKey, err := lunarRedisClient.MarshalKey(key)
	assert.Nil(t, err)

	key, err = lunarRedisClient.UnmarshalKey(marshalledKey)
	assert.Nil(t, err)
	expectedKey := lunarRedisClient.NewKey().
		Append(lunarRedisClient.UnhashedKeyPart("lunar")).
		Append(lunarRedisClient.HashedKeyPart("policyA")).
		Append(lunarRedisClient.UnhashedKeyPart("counter"))
	assert.Equal(t, expectedKey, key)
}

func TestUnmarshalKeyEmptyKey(t *testing.T) {
	marshalledKey := `[]`
	key, err := lunarRedisClient.UnmarshalKey(marshalledKey)
	assert.Nil(t, err)
	expectedKey := lunarRedisClient.NewKey()
	assert.Equal(t, expectedKey, key)
}

func TestUnmarshalKeyInvalidJSON(t *testing.T) {
	marshalledKey := `[["lunar",false],["policyA",true],["counter",false]`
	_, err := lunarRedisClient.UnmarshalKey(marshalledKey)
	assert.NotNil(t, err)
}
