package quotaresource

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTranslatePercentageToFixedWindow(t *testing.T) {
	strategyConfig := &StrategyConfig{
		AllocationPercentage: 60,
	}

	strategyConfig.TranslatePercentageToFixedWindow(10, 1, "hour")

	assert.Equal(t, strategyConfig.FixedWindow.Max, int64(6))

	strategyConfig = &StrategyConfig{
		AllocationPercentage: 60,
	}

	strategyConfig.TranslatePercentageToFixedWindow(10, 1, "hour")

	assert.NotEqual(t, strategyConfig.FixedWindow.Max, int64(7))
}
