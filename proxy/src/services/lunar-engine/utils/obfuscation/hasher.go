package obfuscation

import (
	"crypto/md5"
	"encoding/hex"
)

type Hasher interface {
	HashBytes(raw []byte) string
}

type MD5Hasher struct{}

func (hasher MD5Hasher) HashBytes(raw []byte) string {
	hash := md5.Sum(raw)
	return hex.EncodeToString(hash[:])
}

type FixedHasher struct {
	Value string
}

// The simplest, lossy hasher, used in tests
func (hasher FixedHasher) HashBytes(_ []byte) string {
	return hasher.Value
}
