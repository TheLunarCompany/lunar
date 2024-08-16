package streams

import (
	"fmt"
	streamtypes "lunar/engine/streams/types"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestContext(t *testing.T) {
	context := streamtypes.NewContext()

	t.Run("Set and Get", func(t *testing.T) {
		err := context.Set("key1", "value1")
		require.NoError(t, err)

		val, err := context.Get("key1")
		require.NoError(t, err)
		require.Equal(t, "value1", val)
	})

	t.Run("Get non-existent key", func(t *testing.T) {
		_, err := context.Get("nonExistentKey")
		require.Error(t, err)
		require.Equal(t, fmt.Sprintf("key %s not found", "nonExistentKey"), err.Error())
	})

	t.Run("Pop existent key", func(t *testing.T) {
		err := context.Set("key2", "value2")
		require.NoError(t, err)

		val, err := context.Pop("key2")
		require.NoError(t, err)
		require.Equal(t, "value2", val)

		_, err = context.Get("key2")
		require.Error(t, err)
	})

	t.Run("Pop non-existent key", func(t *testing.T) {
		_, err := context.Pop("nonExistentKey")
		require.Error(t, err)
		require.Equal(t, fmt.Sprintf("key %s not found", "nonExistentKey"), err.Error())
	})
}

func TestLunarContext(t *testing.T) {
	globalContext := streamtypes.NewContext()
	flowContext := streamtypes.NewContext()
	transactionalContext := streamtypes.NewContext()

	lunarContext := streamtypes.NewLunarContext(globalContext)
	lunarContext.SetFlowContext(flowContext)
	lunarContext.InitiateTransactionalContext()

	t.Run("GetGlobalContext", func(t *testing.T) {
		require.Equal(t, globalContext, lunarContext.GetGlobalContext())
	})

	t.Run("GetFlowContext", func(t *testing.T) {
		require.Equal(t, flowContext, lunarContext.GetFlowContext())
	})

	t.Run("GetTransactionalContext", func(t *testing.T) {
		require.Equal(t, transactionalContext, lunarContext.GetTransactionalContext())
	})

	t.Run("InitiateTransactionalContext", func(t *testing.T) {
		lunarContext.InitiateTransactionalContext()
		transactionalCtx := lunarContext.GetTransactionalContext()
		err := transactionalCtx.Set("transactionalKey", "transactionalValue")
		require.NoError(t, err)

		lunarContext.InitiateTransactionalContext()

		newTransactionalContext := lunarContext.GetTransactionalContext()
		_, err = newTransactionalContext.Get("transactionalKey")
		require.Error(t, err)
	})
}
