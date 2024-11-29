package main

import (
	"context"
	"fmt"
	"lunar/engine/communication"
	"lunar/engine/config"
	"lunar/engine/failsafe"
	"lunar/engine/routing"
	"lunar/engine/utils/environment"
	contextmanager "lunar/toolkit-core/context-manager"
	"lunar/toolkit-core/logging"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"time"

	spoe "github.com/TheLunarCompany/haproxy-spoe-go"
	"github.com/rs/zerolog/log"
)

const (
	lunarEnginePort string = "12345"
	lunarEngine     string = "lunar-engine"
	lunarHub        string = "lunar-hub"
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

	proxyTimeout, err := getProxyTimeout()
	if err != nil {
		log.Fatal().Stack().Err(err).Msg("Could not get proxy timeout")
	}

	ctx, cancelCtx := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancelCtx()

	ctxMng := contextmanager.Get().WithContext(ctx)
	statusMsg := ctxMng.GetStatusMessage()
	clock := ctxMng.GetClock()
	telemetryWriter := logging.ConfigureLogger(lunarEngine, true, clock)
	if environment.IsEngineFailsafeEnabled() {
		statusMsg.AddMessage(lunarEngine, "FailSafe: Enabled")

		logging.SetLoggerOnPanicCustomFunc(config.UnmanageAll)
	} else {
		statusMsg.AddMessage(lunarEngine, "FailSafe: Disabled")
	}

	if telemetryWriter != nil {
		defer telemetryWriter.Close()
	}

	var hubComm *communication.HubCommunication
	lunarAPIKey := environment.GetAPIKey()
	if lunarAPIKey == "" {
		statusMsg.AddMessage(lunarHub, "APIKey: Not Provided")
		statusMsg.AddMessage(lunarHub, "Lunar Hub: Not Connected")

	} else if hubComm = communication.NewHubCommunication(
		lunarAPIKey,
		environment.GetGatewayInstanceID(),
		clock,
	); hubComm != nil {
		statusMsg.AddMessage(lunarHub, "APIKey: Provided")
		statusMsg.AddMessage(lunarHub, "Lunar Hub: Connected")
		hubComm.StartDiscoveryWorker()
		defer hubComm.Stop()
	}
	gatewayID := environment.GetGatewayInstanceID()
	if gatewayID == "" {
		log.Warn().Msg("Gateway instance ID was not generated properly")
	}
	statusMsg.AddMessage(lunarEngine, fmt.Sprintf("Gateway ID: %s", gatewayID))
	statusMsg.AddMessage(lunarEngine, fmt.Sprintf("Gateway Version: %s",
		environment.GetProxyVersion()))
	statusMsg.AddMessage(lunarEngine, fmt.Sprintf("Tenant Name: %s", tenantName))
	statusMsg.AddMessage(lunarEngine, fmt.Sprintf("Log Level: %s",
		environment.GetLogLevel()))
	statusMsg.AddMessage(lunarEngine, fmt.Sprintf("Bind on port: %s",
		environment.GetBindPort()))
	statusMsg.AddMessage(lunarEngine, fmt.Sprintf("HealthCheck port: %s",
		environment.GetHAProxyHealthcheckPort()))
	handlingDataMng := routing.NewHandlingDataManager(proxyTimeout, hubComm)
	if err = handlingDataMng.Setup(telemetryWriter); err != nil {
		log.Panic().
			Stack().
			Err(err).
			Msgf("Failed to setup handling data manager, error: %v", err)
	}
	defer handlingDataMng.Shutdown()

	mux := http.NewServeMux()
	handlingDataMng.SetHandleRoutes(mux)

	go func() {
		adminAddr := fmt.Sprintf("0.0.0.0:%s", adminPort)
		if err = http.ListenAndServe(adminAddr, mux); err != nil {
			handlingDataMng.StopDiagnosisWorker()
			log.Fatal().
				Stack().
				Err(err).
				Msg("Could not bring up engine admin server")
		}
	}()

	watcher, err := failsafe.NewDiagnosisFailsafeStateChangeWatcher(
		handlingDataMng.GetTxnPoliciesAccessor(),
		clock,
	)
	if err != nil {
		log.Panic().
			Stack().
			Err(err).
			Msg("Could not create diagnosis failsafe state change watcher")
	}
	watcher.RunInBackground()

	agent := spoe.New(spoe.Handler(routing.Handler(handlingDataMng)))
	statusMsg.Notify()
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
