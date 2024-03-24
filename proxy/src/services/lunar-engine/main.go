package main

import (
	"context"
	"fmt"
	"lunar/engine/communication"
	"lunar/engine/config"
	"lunar/engine/routing"
	"lunar/engine/runner"
	"lunar/engine/services"
	"lunar/engine/streams"
	streamconfig "lunar/engine/streams/config"
	"lunar/engine/utils/environment"
	"lunar/engine/utils/writers"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/logging"
	"lunar/toolkit-core/otel"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"time"

	sharedConfig "lunar/shared-model/config"

	spoe "github.com/TheLunarCompany/haproxy-spoe-go"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

const (
	policiesConfigEnvVar   string = "LUNAR_PROXY_POLICIES_CONFIG"
	lunarEnginePort        string = "12345"
	lunarEngine            string = "lunar-engine"
	syslogExporterEndpoint string = "127.0.0.1:5140"
	proxyIDPrefix          string = "proxy-"
)

var (
	adminPort                        = os.Getenv("ENGINE_ADMIN_PORT")
	serverProxyTimeoutSecondsEnvVar  = "LUNAR_SERVER_TIMEOUT_SEC"
	connectProxyTimeoutSecondsEnvVar = "LUNAR_CONNECT_TIMEOUT_SEC"
	discoveryStateLocation           = environment.GetDiscoveryStateLocation()
	remedyStatsStateLocation         = environment.GetRemedyStateLocation()
)

func main() {
	log.Info().Msgf("🚀 Starting Lunar Engine")
	tenantName := environment.GetTenantName()
	if tenantName == "" {
		log.Panic().Msgf("TENANT_NAME env var is not set")
	}
	proxyID := proxyIDPrefix + uuid.NewString()

	proxyTimeout, err := getProxyTimeout()
	if err != nil {
		log.Fatal().
			Stack().
			Err(err).
			Msg("Could not get proxy timeout")
	}

	clock := clock.NewRealClock()
	telemetryWriter := logging.ConfigureLogger(lunarEngine, true, clock)
	if telemetryWriter != nil {
		defer telemetryWriter.Close()
	}

	ctx, cancelCtx := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancelCtx()

	writer := writers.Dial("tcp", syslogExporterEndpoint, clock)

	// TODO: The following lines will need to be refactored once streams are enabled
	var txnPoliciesAccessor *config.TxnPoliciesAccessor
	var diagnosisWorker *runner.DiagnosisWorker

	if environment.IsStreamsEnabled() {
		streams := streams.NewStream()
		streamsConfig, streamErr := streamconfig.GetFlows()
		if streamErr != nil {
			log.Panic().Stack().Err(streamErr).Msg("Failed to parse streams config")
		}
		if err = streams.CreateFlows(streamsConfig); err != nil {
			log.Panic().Stack().Err(err).Msg("Failed to create flows")
		}

	} else {
		diagnosisWorker = runner.NewDiagnosisWorker(clock)

		sharedConfig.Validate.RegisterStructValidation(
			config.ValidateStructLevel,
			sharedConfig.Remedy{},         //nolint: exhaustruct
			sharedConfig.Diagnosis{},      //nolint: exhaustruct
			sharedConfig.PoliciesConfig{}, //nolint: exhaustruct
		)
		err = sharedConfig.Validate.RegisterValidation(
			"validateInt",
			config.ValidateInt,
		)
		if err != nil {
			log.Panic().Stack().Err(err).Msg("Failed to register config validation")
		}

		configBuildResult, err := config.BuildInitialFromFile(clock)
		if err != nil {
			log.Panic().Stack().Err(err).Msg("Failed to build policy tree")
		}
		txnPoliciesAccessor = configBuildResult.Accessor
		initialPoliciesData := configBuildResult.Initial

		shutdownOtel := otel.InitProvider(
			ctx,
			lunarEngine,
			initialPoliciesData.Config.Exporters,
		)
		defer shutdownOtel()
	}

	go otel.ServeMetrics()

	services, err := services.Initialize(
		ctx,
		clock,
		writer,
		proxyTimeout,
	)
	if err != nil {
		log.Panic().Stack().Err(err).Msg("Failed to initialize services")
	}

	lunarAPIKey := environment.GetAPIKey()
	if lunarAPIKey == "" {
		log.Debug().Msg("Lunar API Key is missing, Hub communication is down.")
	} else if hubComm := communication.NewHubCommunication(
		lunarAPIKey,
		proxyID,
		clock,
	); hubComm != nil {
		hubComm.StartDiscoveryWorker()
		defer hubComm.Stop()
	}

	mux := http.NewServeMux()

	mux.HandleFunc(
		"/apply_policies",
		routing.HandleApplyPolicies(txnPoliciesAccessor, writer),
	)

	mux.HandleFunc(
		"/validate_policies",
		routing.HandleValidatePolicies(),
	)

	mux.HandleFunc(
		"/discover",
		routing.HandleJSONFileRead(discoveryStateLocation),
	)

	mux.HandleFunc(
		"/remedy_stats",
		routing.HandleJSONFileRead(remedyStatsStateLocation),
	)

	mux.HandleFunc(
		"/handshake",
		routing.HandleHandshake(),
	)

	go func() {
		adminAddr := fmt.Sprintf("0.0.0.0:%s", adminPort)
		if err := http.ListenAndServe(adminAddr, mux); err != nil {
			diagnosisWorker.Stop()
			log.Fatal().
				Stack().
				Err(err).
				Msg("Could not bring up engine admin server")
		}
	}()
	agent := spoe.New(
		routing.Handler(ctx, txnPoliciesAccessor, services,
			diagnosisWorker, clock),
	)

	log.Info().Msg("✅ Lunar Proxy is up and running")

	if err := agent.
		ListenAndServe(fmt.Sprintf("0.0.0.0:%s", lunarEnginePort)); err != nil {
		diagnosisWorker.Stop()
		log.Fatal().
			Stack().
			Err(err).
			Msg("Could not bring up engine SPOE server")
	}
}

func getProxyTimeout() (time.Duration, error) {
	proxyServerTimeoutSeconds, err := readEnvVarAsInt(
		serverProxyTimeoutSecondsEnvVar,
	)
	if err != nil {
		return 0, err
	}

	proxyConnectTimeoutSeconds, err := readEnvVarAsInt(
		connectProxyTimeoutSecondsEnvVar,
	)
	if err != nil {
		return 0, err
	}
	proxyTimeoutSeconds := proxyServerTimeoutSeconds + proxyConnectTimeoutSeconds
	return time.Duration(proxyTimeoutSeconds) * time.Second, nil
}

func readEnvVarAsInt(envVar string) (int, error) {
	rawValue := os.Getenv(envVar)
	asInt, err := strconv.Atoi(rawValue)
	if err != nil {
		return 0, fmt.Errorf(
			"env var %s could not be converted into int (%s)",
			envVar, rawValue,
		)
	}
	return asInt, nil
}
