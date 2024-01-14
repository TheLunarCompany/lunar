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
