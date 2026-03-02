package actions_test

import (
	sharedActions "lunar/shared-model/actions"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTimestampToStringFromInt64(t *testing.T) {
	// Create a sample timestamp in milliseconds
	timestamp := int64(1675789662000)

	// Call the TimestampToString function
	result := sharedActions.TimestampToStringFromInt64(
		timestamp)

	// Define the expected output
	expected := "2023-02-07T17:07:42Z"

	assert.Equal(t, result, expected)
}

func TestTimestampFromStringToInt64(t *testing.T) {
	// Create a sample timestamp string
	timestamp := "2023-02-07T17:07:42Z"

	// Call the TimestampFromString function
	result, err := sharedActions.TimestampFromStringToInt64(
		timestamp)

	// Define the expected output
	expected := int64(1675789662000)

	assert.Nil(t, err)
	assert.Equal(t, result, expected)
}

func TestTimestampFromStringToInt64WithInvalidTimestamp(t *testing.T) {
	// Create an invalid timestamp string
	timestamp := "invalid-timestamp"

	// Call the TimestampFromString function
	_, err := sharedActions.TimestampFromStringToInt64(
		timestamp)

	assert.NotNil(t, err)
}
