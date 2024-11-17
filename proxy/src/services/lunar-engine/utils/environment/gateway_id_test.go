package environment

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetGatewayIDSingleton(t *testing.T) {
	instance1 := GetGatewayID()
	require.NotNil(t, instance1, "The singleton instance should not be nil")

	instance2 := GetGatewayID()
	require.NotNil(t, instance2, "The singleton instance should not be nil")

	require.Equal(t, instance1, instance2, "Both calls to GetGatewayID should return the same instance")
}

func TestGetIDGeneratesNonEmptyID(t *testing.T) {
	instance := GetGatewayID()
	id := instance.ID()
	require.NotEmpty(t, id, "The ID should not be empty after calling GetID")
}

func TestGetIDGeneratesOnlyOnce(t *testing.T) {
	instance := GetGatewayID()

	id1 := instance.ID()
	require.NotEmpty(t, id1, "The ID should not be empty on the first call to GetID")

	id2 := instance.ID()
	require.Equal(t, id1, id2, "The ID should be the same on subsequent calls to GetID")
}

func TestRandomIDGenerationOnSingletonInstance(t *testing.T) {
	instance1 := GetGatewayID()
	id1 := instance1.ID()

	// Reset singleton for test
	once = sync.Once{}
	gatewayIDInstance = nil

	// Create a new singleton instance and generate another ID
	instance2 := GetGatewayID()
	id2 := instance2.ID()

	// Verify the new ID is different
	require.NotEqual(t, id1, id2, "The ID should be different after singleton reset")
}
