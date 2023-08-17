package vacuum

import (
	"lunar/toolkit-core/clock"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

type mapVacuumEntry[K comparable, V any] struct {
	vacuumAt    time.Time
	keyToVacuum K
}

type MapVacuum[K comparable, V any] struct {
	name         string
	entries      []mapVacuumEntry[K, V]
	ttl          time.Duration
	clock        clock.Clock
	tick         time.Duration
	entriesMutex *sync.RWMutex
	mapToVacuum  map[K]V
	mapMutex     *sync.RWMutex
	active       bool
}

func NewMapVacuum[K comparable, V any](
	name string,
	clock clock.Clock,
	ttl time.Duration,
	tick time.Duration,
	mapToVacuum map[K]V,
	mapMutex *sync.RWMutex,
) MapVacuum[K, V] {
	return MapVacuum[K, V]{
		name:         name,
		entries:      []mapVacuumEntry[K, V]{},
		ttl:          ttl,
		clock:        clock,
		tick:         tick,
		entriesMutex: &sync.RWMutex{},
		mapToVacuum:  mapToVacuum,
		mapMutex:     mapMutex,
		active:       false,
	}
}

func (mapVacuum *MapVacuum[K, V]) VacuumKey(keyToVacuum K) {
	entry := mapVacuumEntry[K, V]{
		vacuumAt:    mapVacuum.clock.Now().Add(mapVacuum.ttl),
		keyToVacuum: keyToVacuum,
	}
	mapVacuum.entriesMutex.Lock()
	defer mapVacuum.entriesMutex.Unlock()
	mapVacuum.entries = append(mapVacuum.entries, entry)

	if !mapVacuum.active {
		mapVacuum.active = true
		mapVacuum.vacuumInBackground()
		log.Debug().
			Msgf("vacuum (%s) turned on and will run in the background",
				mapVacuum.name)

	}
}

func (mapVacuum *MapVacuum[K, V]) vacuumInBackground() {
	go func() {
		for mapVacuum.active {
			mapVacuum.vacuum()
			mapVacuum.clock.Sleep(mapVacuum.tick)
		}
	}()
}

func (mapVacuum *MapVacuum[K, V]) vacuum() {
	mapVacuum.entriesMutex.RLock()
	mapVacuumEntries := mapVacuum.entries
	mapVacuum.entriesMutex.RUnlock()

	if len(mapVacuumEntries) == 0 {
		return
	}

	deleteUntil := 0
	now := mapVacuum.clock.Now()
	mapVacuum.mapMutex.Lock()
	for _, entry := range mapVacuum.entries {
		if entry.vacuumAt.Before(now) {
			delete(mapVacuum.mapToVacuum, entry.keyToVacuum)
			deleteUntil++
		} else {
			break
		}
	}
	mapVacuum.mapMutex.Unlock()

	// check if needed
	mapVacuum.entriesMutex.Lock()
	mapVacuum.entries = mapVacuum.entries[deleteUntil:]
	mapVacuum.entriesMutex.Unlock()
	if deleteUntil > 0 {
		log.Debug().
			Msgf("vacuum (%s) vacuumed %d entries", mapVacuum.name, deleteUntil)
	}
}
