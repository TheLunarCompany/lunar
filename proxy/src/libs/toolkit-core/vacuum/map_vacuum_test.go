package vacuum_test

import (
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/vacuum"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestMapVacuumCleansVacuumedKeyOnlyAfterTTLPasses(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	ttl := 5 * time.Second
	tick := 1 * time.Second
	mapToVacuum := map[string]string{}
	mapMutex := sync.RWMutex{}
	mapVacuum := vacuum.NewMapVacuum(
		"test",
		clock,
		ttl,
		tick,
		mapToVacuum,
		&mapMutex,
	)

	mapToVacuum["hello"] = "world"
	mapVacuum.VacuumKey("hello")
	for i := 0; i < 5; i++ {
		mapMutex.RLock()
		assert.NotEmpty(t, mapToVacuum)
		mapMutex.RUnlock()
		clock.AdvanceTime(tick + 1)
		time.Sleep(1 * time.Millisecond)
	}
	mapMutex.RLock()
	assert.Empty(t, mapToVacuum)
	mapMutex.RUnlock()
}

func TestMapVacuumKeepsKeyIfVacuumKeyNotCalledOnIt(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	ttl := 5 * time.Second
	tick := 1 * time.Second
	mapToVacuum := map[string]string{}
	mapMutex := sync.RWMutex{}
	mapVacuum := vacuum.NewMapVacuum(
		"test",
		clock,
		ttl,
		tick,
		mapToVacuum,
		&mapMutex,
	)

	mapToVacuum["hello"] = "world"
	mapToVacuum["keep"] = "me"
	// only `hello` is added to vacuum
	mapVacuum.VacuumKey("hello")
	for i := 0; i < 5; i++ {
		mapMutex.RLock()
		hello := mapToVacuum["hello"]
		keep := mapToVacuum["keep"]
		mapMutex.RUnlock()
		assert.Equal(t, "world", hello)
		assert.Equal(t, "me", keep)

		clock.AdvanceTime(tick + 1)
		time.Sleep(1 * time.Millisecond)
	}

	mapMutex.RLock()
	_, helloFound := mapToVacuum["hello"]
	keep := mapToVacuum["keep"]
	mapMutex.RUnlock()
	assert.False(t, helloFound)
	assert.Equal(t, "me", keep)
}

func TestMapVacuumDoesNothingIfVacuumedKeyIsDeletedBeforeVacuumRuns(
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	ttl := 5 * time.Second
	tick := 1 * time.Second
	mapToVacuum := map[string]string{}
	mapMutex := sync.RWMutex{}
	mapVacuum := vacuum.NewMapVacuum(
		"test",
		clock,
		ttl,
		tick,
		mapToVacuum,
		&mapMutex,
	)

	mapToVacuum["hello"] = "world"
	mapVacuum.VacuumKey("hello")
	delete(mapToVacuum, "hello")
	for i := 0; i < 5; i++ {
		mapMutex.RLock()
		assert.Empty(t, mapToVacuum)
		mapMutex.RUnlock()
		clock.AdvanceTime(tick + 1)
		time.Sleep(1 * time.Millisecond)
	}
	mapMutex.RLock()
	assert.Empty(t, mapToVacuum)
	mapMutex.RUnlock()
}
