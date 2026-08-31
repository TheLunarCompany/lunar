package main

import (
	"C"
	"lunar/aggregation-plugin/common"
	sharedDiscovery "lunar/shared-model/discovery"
	"lunar/toolkit-core/urltree"
	"os"
	"strconv"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/samber/lo"
)

const (
	treeRefreshRateEnvVar  = "LUNAR_AGGREGATION_TREE_REFRESH_SECS"
	defaultTreeRefreshRate = time.Duration(5 * time.Minute)
)

func getTreeRefreshRate() time.Duration {
	raw, valid := os.LookupEnv(treeRefreshRateEnvVar)
	if !valid {
		log.Warn().
			Msgf("Env var %v not defined, will use %v as default",
				treeRefreshRateEnvVar, defaultTreeRefreshRate)
		return defaultTreeRefreshRate
	}
	seconds, err := strconv.Atoi(raw)
	if err != nil {
		log.Warn().
			Err(err).
			Msgf("Could not parse %v as number, will use %v as default",
				raw, defaultTreeRefreshRate)
	}
	duration := time.Duration(seconds) * time.Second
	log.Info().Msgf("Will use %v as tree refresh rate", duration)

	return duration
}

//

var fallbackTree *common.SimpleURLTree = urltree.NewURLTree[common.EmptyStruct](
	false,
	0,
)

func periodicallyUpdateTree(
	updatedTreeF func(*common.SimpleURLTree),
	refreshInterval time.Duration,
	currentKnownEndpoints *sharedDiscovery.KnownEndpoints,
	currentLastModified time.Time,
	maxSplitThreshold int,
) {
	ticker := time.NewTicker(refreshInterval)
	for {
		<-ticker.C
		newLastModified, err := common.GetPoliciesLastModifiedTime()
		if err != nil {
			log.Error().Stack().
				Err(err).
				Msg("🛑 Failed to get last modified time for endpoints," +
					"will use existing tree")
			continue
		}

		if newLastModified.UnixMilli() <= currentLastModified.UnixMilli() {
			log.Trace().
				Msg("No changes detected in known endpoints, will keep current tree")
			continue
		}

		newKnownEndpoints, err := common.ReadKnownEndpoints()
		if err != nil {
			log.Error().Stack().
				Err(err).
				Msg("🛑 Failed to reload known endpoints, will use existing tree")
			continue
		}
		addedEndpoints, droppedEndpoints := lo.Difference(
			newKnownEndpoints.Endpoints,
			currentKnownEndpoints.Endpoints,
		)

		tree, err := common.BuildTree(*newKnownEndpoints, maxSplitThreshold)
		if err != nil {
			log.Error().Stack().
				Err(err).
				Msg("🛑 Failed to build tree from known endpoints," +
					"will use existing tree")
			continue
		}
		currentKnownEndpoints = newKnownEndpoints
		currentLastModified = newLastModified

		updatedTreeF(tree)

		log.Trace().
			Msgf("Tree top level constant children: %v",
				lo.Keys(tree.Root.ConstantChildren))

		log.Debug().
			Msgf("✅ Successfully reloaded endpoints tree (added %d, dropped %d)",
				len(addedEndpoints), len(droppedEndpoints))
	}
}
