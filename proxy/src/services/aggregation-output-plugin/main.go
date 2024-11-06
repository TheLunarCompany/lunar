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
	"strconv"
	"sync"
	"time"
)

const (
	PluginName               = "aggregation"
	PluginDesc               = "Aggregation"
	appName                  = "aggregation-output-plugin"
	urlTreeMaxSplitThreshold = 50
)

var (
	discoveryStateLocation       = os.Getenv("DISCOVERY_STATE_LOCATION")
	apiCallsMetricsStateLocation = os.Getenv("API_CALLS_METRICS_STATE_LOCATION")
	remedyStatsStateLocation     = os.Getenv("REMEDY_STATE_LOCATION")
	autoExitMu                   sync.Mutex
)

type PluginContext struct {
	endpointTree     *common.SimpleURLTree
	discoveryState   *discovery.State
	apiCallsState    *discovery.APICallsState
	remedyStatsState *remedy.State
	clock            clock.Clock
}

func autoExit() {
	exitAfterMinutes := 60 // Default exit timeout - 1 hour

	if val, exists := os.LookupEnv("EXIT_AFTER_MINUTES"); exists {
		if minutes, err := strconv.Atoi(val); err == nil {
			exitAfterMinutes = minutes
		}
	}

	// if auto-exit is canceled
	if cancelExit, exists := os.LookupEnv("CANCEL_AUTO_EXIT"); exists && cancelExit == "true" {
		log.Trace().Msg("Auto-exit is canceled")
		return // Do not start the auto-exit timer
	}

	// Start a timer in a separate goroutine for asynchronous exit
	go func() {
		timer := time.NewTimer(time.Duration(exitAfterMinutes) * time.Minute)
		log.Trace().Msgf("Auto-exit timer started for %d minutes", exitAfterMinutes)

		// Wait for the timer to expire
		<-timer.C

		// wait for the mutex to be available - don't exit if FLBPluginFlushCtx is running
		autoExitMu.Lock()
		defer autoExitMu.Unlock()

		log.Trace().Msg("Auto-exit timer expired - exiting aggregation plugin")
		os.Exit(0)
	}()
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

	go autoExit()

	discoveryState := discovery.State{
		DiscoverFilepath: discoveryStateLocation,
	}
	err := discoveryState.InitializeState()
	if err != nil {
		log.Error().Stack().
			Err(err).
			Msg("🛑 Failed to initialize: could not create " +
				"discovery aggregation state file")

		return output.FLB_ERROR
	}
	apiCallsState := discovery.APICallsState{StateFilePath: apiCallsMetricsStateLocation}
	err = apiCallsState.InitializeState()
	if err != nil {
		log.Error().Stack().
			Err(err).
			Msg("🛑 Failed to initialize: could not create api calls state file")
		return output.FLB_ERROR
	}

	remedyStatsState := remedy.State{Filepath: remedyStatsStateLocation}
	if !common.IsFlowsEnabled() {
		err = remedyStatsState.Initialize()
		if err != nil {
			log.Error().Stack().
				Err(err).
				Msg("🛑 Failed to initialize: could not initialize " +
					"remedy stats aggregation state file")

			return output.FLB_ERROR
		}
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

	currentTree, err := common.BuildTree(
		*currentKnownEndpoints,
		urlTreeMaxSplitThreshold,
	)
	if err != nil {
		log.Error().Stack().
			Err(err).
			Msg("🛑 Failed to initialize: could not build tree from known endpoints")

		return output.FLB_ERROR
	}

	pluginContext := PluginContext{
		endpointTree:     currentTree,
		remedyStatsState: &remedyStatsState,
		apiCallsState:    &apiCallsState,
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
		urlTreeMaxSplitThreshold,
	)

	return output.FLB_OK
}

//export FLBPluginFlushCtx
func FLBPluginFlushCtx(
	ctx, data unsafe.Pointer,
	length C.int,
	_ *C.char,
) int {
	autoExitMu.Lock()
	defer autoExitMu.Unlock()

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

	err := discovery.Run(context.discoveryState, context.apiCallsState, records, tree)
	if err != nil {
		log.Error().Stack().Err(err).Msg("Discovery processing failed")
		return output.FLB_ERROR
	}

	if !common.IsFlowsEnabled() {
		err = remedy.Run(context.remedyStatsState, records, tree, context.clock)
		if err != nil {
			log.Error().Stack().Err(err).Msg("Remedy Stats processing failed")
			return output.FLB_ERROR
		}
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
