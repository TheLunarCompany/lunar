package redis

import (
	"errors"
	"strings"
)

// Handling Keys in Redis can be a sensitive issue when Redis Cluster is
// involved. See more here: https://redis.io/docs/management/scaling,
// specifically the part about "Redis Cluster data sharding" and
// handling keys in multiple key operations.
// This file offers utilities to handle the construction of
// Redis keys in a high-level, safe manner, mostly around managing hash tags.

type KeyPart struct {
	part          string
	useForHashing bool
}

type (
	Key      []KeyPart
	LunarKey = string
)

var ErrMoreThanOneHashGroup = errors.New(
	"cannot build key: only one hashing sequence allowed",
)
var ErrKeyIsNil = errors.New("key is nil")

func (keyPart KeyPart) Part() string {
	return keyPart.part
}

func UnhashedKeyPart(part string) KeyPart {
	return KeyPart{part: part, useForHashing: false}
}

func HashedKeyPart(part string) KeyPart {
	return KeyPart{part: part, useForHashing: true}
}

var WildcardKeyPart = KeyPart{part: "*", useForHashing: false}

func NewKey() Key {
	return Key{}
}

func (key Key) Append(keyPart KeyPart) Key {
	return append(key, keyPart)
}

func (key Key) Prepend(keyPart KeyPart) Key {
	return append([]KeyPart{keyPart}, key...)
}

func (key Key) Build(delimiter string) (string, error) {
	if key == nil {
		return "", ErrKeyIsNil
	}

	var result strings.Builder
	hashedParts := make([]string, 0)
	hashedPartsFound := false
	multipleHashGroups := false

	for _, part := range key {
		if part.useForHashing {
			hashedPartsFound = true
			hashedParts = append(hashedParts, part.part)
		} else {
			if hashedPartsFound {
				if multipleHashGroups {
					// More than one group of hashed parts found
					return "", ErrMoreThanOneHashGroup
				}
				if result.Len() > 0 {
					result.WriteString(delimiter)
				}
				result.WriteString("{" + strings.Join(hashedParts, delimiter) + "}")
				hashedParts = make([]string, 0)
				hashedPartsFound = false
				multipleHashGroups = true
			}
			if result.Len() > 0 {
				result.WriteString(delimiter)
			}
			result.WriteString(part.part)
		}
	}

	if hashedPartsFound {
		if multipleHashGroups {
			// More than one group of hashed parts found
			return "", ErrMoreThanOneHashGroup
		}
		if result.Len() > 0 {
			result.WriteString(delimiter)
		}
		result.WriteString("{" + strings.Join(hashedParts, delimiter) + "}")
	}

	return result.String(), nil
}
