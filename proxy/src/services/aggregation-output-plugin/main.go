package main

import (
	"C"
	"lunar/aggregation-plugin/common"
	"lunar/aggregation-plugin/discovery"
	"lunar/aggregation-plugin/remedy"
	"lunar/toolkit-core/logging"
	"unsafe"

	"github.com/fluent/fluent-bit-go/output"
	"github.com/rs/zerolog/log"
)

import (
	"lunar/toolkit-core/clock"
	"os"
)

const (
	PluginName = "aggregation"
	PluginDesc = "Aggregation"
	appName    = "aggregation-output-plugin"
)

var (
	discoveryStateLocation   = os.Getenv("DISCOVERY_STATE_LOCATION")
	remedyStatsStateLocation = os.Getenv("REMEDY_STATE_LOCATION")
)

type PluginContext struct {
	endpointTree     *common.SimpleURLTree
	discoveryState   *discovery.State
	remedyStatsState *remedy.State
	clock            clock.Clock
}

//export FLBPluginRegister
func FLBPluginRegister(def unsafe.Pointer) int {
	logging.ConfigureLogger(appName, false, clock.NewRealClock())

	log.Info().Msg("Registering plugin")
	return output.FLBPluginRegister(def, PluginName, PluginDesc)
}

//export FLBPluginInit
func FLBPluginInit(plugin unsafe.Pointer) int {
	log.Info().Msgf("Initializing %s plugin", appName)

	discoveryState := discovery.State{
		Filepath: discoveryStateLocation,
		Clock:    clock.NewRealClock(),
	}
	err := discoveryState.InitializeState()
	if err != nil {
		log.Error().Stack().
			Err(err).
			Msg("🛑 Failed to initialize: could not create " +
				"discovery aggregation state file")

		return output.FLB_ERROR
	}

	remedyStatsState := remedy.State{Filepath: remedyStatsStateLocation}
	err = remedyStatsState.Initialize()
	if err != nil {
		log.Error().Stack().
			Err(err).
			Msg("🛑 Failed to initialize: could not initialize " +
				"remedy stats aggregation state file")

		return output.FLB_ERROR
	}

	lastModified, err := common.GetPoliciesLastModifiedTime()
	if err != nil {
		log.Error().Stack().
			Err(err).
			Msg("🛑 Failed to initialize: could not get last modified of known endpoints")

		return output.FLB_ERROR
	}
	currentKnownEndpoints, err := common.ReadKnownEndpoints()
	if err != nil {
		log.Error().Stack().
			Err(err).
			Msg("🛑 Failed to initialize: could not load known endpoints")

		return output.FLB_ERROR
	}
	currentTree, err := common.BuildTree(*currentKnownEndpoints)
	if err != nil {
		log.Error().Stack().
			Err(err).
			Msg("🛑 Failed to initialize: could not build tree from known endpoints")

		return output.FLB_ERROR
	}

	pluginContext := PluginContext{
		endpointTree:     currentTree,
		remedyStatsState: &remedyStatsState,
		discoveryState:   &discoveryState,
		clock:            clock.NewRealClock(),
	}
	treeRefreshInterval := getTreeRefreshRate()

	output.FLBPluginSetContext(plugin, pluginContext)

	updateTreeF := func(tree *common.SimpleURLTree) {
		updatedContext := pluginContext
		updatedContext.endpointTree = tree
		output.FLBPluginSetContext(plugin, updatedContext)
	}

	go periodicallyUpdateTree(
		updateTreeF,
		treeRefreshInterval,
		currentKnownEndpoints,
		lastModified,
	)

	return output.FLB_OK
}

//export FLBPluginFlushCtx
func FLBPluginFlushCtx(
	ctx, data unsafe.Pointer,
	length C.int,
	_ *C.char,
) int {
	context, valid := output.FLBPluginGetContext(ctx).(PluginContext)
	var tree *common.SimpleURLTree
	if !valid {
		log.Error().Stack().Msg("Could not get endpoints tree from context" +
			"will not apply path normalization to access logs")
		tree = fallbackTree
	} else {
		tree = context.endpointTree
		log.Trace().
			Msgf(
				"Got tree from context with %d top level constant children (%v)",
				len(tree.Root.ConstantChildren), tree.Root.ConstantChildren,
			)
	}
	records := discovery.DecodeRecords(data, int(length))

	err := discovery.Run(context.discoveryState, records, tree)
	if err != nil {
		log.Error().Stack().Err(err).Msg("Discovery processing failed")
		return output.FLB_ERROR
	}
	err = remedy.Run(context.remedyStatsState, records, tree, context.clock)
	if err != nil {
		log.Error().Stack().Err(err).Msg("Remedy Stats processing failed")
		return output.FLB_ERROR
	}

	log.Trace().Msg("✍️ successfully updated aggregations")
	return output.FLB_OK
}

//export FLBPluginExit
func FLBPluginExit() int {
	log.Info().Msg("Starting shutdown...")
	return output.FLB_OK
}

// If we drop this we get build warning.
func main() {}
