package obfuscation

import (
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
)

type Hasher interface {
	HashBytes(raw []byte) string
}

// SHA256Hasher is the default obfuscation hasher. It produces a one-way,
// collision-resistant digest used to obfuscate sensitive data.
type SHA256Hasher struct{}

func (hasher SHA256Hasher) HashBytes(raw []byte) string {
	hash := sha256.Sum256(raw)
	return hex.EncodeToString(hash[:])
}

// MD5Hasher is kept for non-security config fingerprinting (see doctor), where
// the resulting digest is exposed through a stable `md5` contract field.
// Do not use it to obfuscate sensitive data.
type MD5Hasher struct{}

func (hasher MD5Hasher) HashBytes(raw []byte) string {
	// deepcode ignore InsecureHash: <config fingerprint only, not for security>
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

// Hasher which returns the input as-is
type IdentityHasher struct{}

func (hasher IdentityHasher) HashBytes(raw []byte) string {
	return string(raw)
}
