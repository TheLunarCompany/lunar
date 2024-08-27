package main

import (
	"context"
	"fmt"
	"lunar/engine/communication"
	"lunar/engine/config"
	"lunar/engine/routing"
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/logging"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"time"

	spoe "github.com/TheLunarCompany/haproxy-spoe-go"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

const (
	policiesConfigEnvVar string = "LUNAR_PROXY_POLICIES_CONFIG"
	lunarEnginePort      string = "12345"
	lunarEngine          string = "lunar-engine"
	proxyIDPrefix        string = "proxy-"
)

var (
	adminPort                        = os.Getenv("ENGINE_ADMIN_PORT")
	serverProxyTimeoutSecondsEnvVar  = "LUNAR_SERVER_TIMEOUT_SEC"
	connectProxyTimeoutSecondsEnvVar = "LUNAR_CONNECT_TIMEOUT_SEC"
)

func main() {
	tenantName := environment.GetTenantName()
	if tenantName == "" {
		log.Panic().Msgf("TENANT_NAME env var is not set")
	}
	proxyID := proxyIDPrefix + uuid.NewString()

	proxyTimeout, err := getProxyTimeout()
	if err != nil {
		log.Fatal().Stack().Err(err).Msg("Could not get proxy timeout")
	}

	clock := clock.NewRealClock()
	telemetryWriter := logging.ConfigureLogger(lunarEngine, true, clock)

	if environment.IsEngineFailsafeEnabled() {
		log.Info().Msg("Engine failsafe is enabled, setting up failsafe handler.")
		logging.SetLoggerOnPanicCustomFunc(config.UnmanageAll)
	}

	if telemetryWriter != nil {
		defer telemetryWriter.Close()
	}

	ctx, cancelCtx := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancelCtx()

	var hubComm *communication.HubCommunication
	lunarAPIKey := environment.GetAPIKey()
	if lunarAPIKey == "" {
		log.Debug().Msg("Lunar API Key is missing, Hub communication is down.")
	} else if hubComm = communication.NewHubCommunication(
		lunarAPIKey,
		proxyID,
		clock,
	); hubComm != nil {
		hubComm.StartDiscoveryWorker()
		defer hubComm.Stop()
	}

	handlingDataMng := routing.NewHandlingDataManager(ctx, clock, proxyTimeout, hubComm)
	if err = handlingDataMng.Setup(); err != nil {
		log.Panic().Stack().Err(err).Msg("Failed to setup handling data manager")
	}
	defer handlingDataMng.Shutdown()

	mux := http.NewServeMux()
	handlingDataMng.SetHandleRoutes(mux)

	go func() {
		adminAddr := fmt.Sprintf("0.0.0.0:%s", adminPort)
		if err := http.ListenAndServe(adminAddr, mux); err != nil {
			handlingDataMng.StopDiagnosisWorker()
			log.Fatal().
				Stack().
				Err(err).
				Msg("Could not bring up engine admin server")
		}
	}()
	agent := spoe.New(spoe.Handler(routing.Handler(handlingDataMng)))

	log.Info().Msg("🚀 Lunar Proxy is up and running")
	if err := agent.
		ListenAndServe(fmt.Sprintf("0.0.0.0:%s", lunarEnginePort)); err != nil {
		handlingDataMng.StopDiagnosisWorker()
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
