//go:build !pro

package streams

import (
	streamtypes "lunar/engine/streams/types"
	"testing"

	"github.com/stretchr/testify/require"
)

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
