package quotaresource

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAssignQuotaLimitForPercentageAllocation(t *testing.T) {
	// Arrange
	child := &StrategyConfig{
		AllocationPercentage: 60,
	}

	parent := &StrategyConfig{
		FixedWindowCustomCounter: &FixedWindowCustomCounterConfig{
			FixedWindowConfig: FixedWindowConfig{
				QuotaLimit: QuotaLimit{
					Max:          10,
					Interval:     1,
					IntervalUnit: "second",
					Spillover:    &Spillover{Max: 90},
				},
				GroupByHeader:  "group",
				MonthlyRenewal: &MonthlyRenewalData{Day: 1, Hour: 1, Minute: 1, Timezone: "UTC"},
			},
			CounterValuePath: `$.response.headers["x-rate-limit-remaining"]`,
		},
	}

	// Act
	err := AssignQuotaLimitForPercentageAllocation(child, parent)
	assert.NoError(t, err)

	// Assert
	// 60% out of 10 is 6 so:
	assert.Equal(t, child.FixedWindowCustomCounter.Max, int64(6))
	// All other fields should be copied from the parent - exactly the same
	assert.Equal(t, child.FixedWindowCustomCounter.Interval, int64(1))
	assert.Equal(t, child.FixedWindowCustomCounter.IntervalUnit, "second")
	assert.Equal(
		t,
		child.FixedWindowCustomCounter.Spillover,
		parent.FixedWindowCustomCounter.Spillover,
	)
	assert.Equal(
		t,
		parent.FixedWindowCustomCounter.GroupByHeader,
		child.FixedWindowCustomCounter.GroupByHeader,
	)
	assert.Equal(
		t,
		parent.FixedWindowCustomCounter.MonthlyRenewal,
		child.FixedWindowCustomCounter.MonthlyRenewal,
	)
	assert.Equal(
		t, parent.FixedWindowCustomCounter.CounterValuePath,
		child.FixedWindowCustomCounter.CounterValuePath)
}
