package contextmanager

import (
	"context"
	"lunar/toolkit-core/clock"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetContextManager(t *testing.T) {
	result := Get()
	require.NotNil(t, result)
	require.Equal(t, instance, result)
}

func TestGetContext(t *testing.T) {
	ctx := context.Background()
	result := Get().GetContext()
	require.Equal(t, ctx, result)
}

func TestGetClock(t *testing.T) {
	clk := clock.NewRealClock()
	result := Get().GetClock()

	require.Equal(t, clk, result)
}

func TestWithMockClock(t *testing.T) {
	result := Get().SetMockClock()
	require.IsType(t, &clock.MockClock{}, result.clock)
}

func TestWithRealClock(t *testing.T) {
	result := Get().SetRealClock()
	require.IsType(t, &clock.RealClock{}, result.clock)
}

func TestWithContext(t *testing.T) {
	ctx := context.Background()
	result := Get().WithContext(ctx)

	require.Equal(t, ctx, result.GetContext())
}
