package actions_test

import (
	sharedActions "lunar/shared-model/actions"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTimestampToStringFromInt64(t *testing.T) {
	// Create a sample timestamp in milliseconds
	timestamp := int64(1675789662939)

	// Call the TimestampToString function
	result := sharedActions.TimestampToStringFromInt64(
		timestamp)

	// Define the expected output
	expected := "2023-02-07T17:07:42Z"

	assert.Equal(t, result, expected)
}
