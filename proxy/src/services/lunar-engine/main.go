package main

import (
	"context"
	"fmt"
	"lunar/engine/communication"
	"lunar/engine/config"
	"lunar/engine/routing"
	"lunar/engine/utils/environment"
	contextmanager "lunar/toolkit-core/context-manager"
	"lunar/toolkit-core/logging"
	"lunar/toolkit-core/network"
	lunar_cluster "lunar/toolkit-core/network/lunar-cluster"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"time"

	"github.com/negasus/haproxy-spoe-go/agent"
	"github.com/negasus/haproxy-spoe-go/logger"
	"github.com/rs/zerolog/log"
)

const (
	lunarEnginePort          = "12345"
	lunarEngine              = "lunar-engine"
	lunarHub                 = "lunar-hub"
	defaultProcessingTimeout = 30
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

	lunarCluster, err := lunar_cluster.NewLunarCluster(environment.GetGatewayInstanceID())
	if err != nil {
		log.Fatal().Stack().Err(err).Msg("Could not create lunar cluster")
	}
	ctxMng.WithClusterLiveness(lunarCluster)

	var hubComm *communication.HubCommunication
	lunarAPIKey := environment.GetAPIKey()
	if lunarAPIKey == "" {
		statusMsg.AddMessage(lunarHub, "APIKey: Not Provided")
		statusMsg.AddMessage(lunarHub, "Lunar Hub: Not Connected")
	} else if hubComm = communication.NewHubCommunication(
		lunarAPIKey,
		environment.GetGatewayInstanceID(),
		clock,
	); hubComm != nil && hubComm.IsConnected() {
		statusMsg.AddMessage(lunarHub, "APIKey: Provided")
		statusMsg.AddMessage(lunarHub, "Lunar Hub: Connected")
		hubComm.StartDiscoveryWorker()
		defer hubComm.Stop()
	}
	// Wait for connection signal and start discovery worker
	if hubComm != nil && !hubComm.IsConnected() {
		go func() {
			<-hubComm.ConnectionEstablishedChannel()
			hubComm.StartDiscoveryWorker()
		}()
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

	spoeListeningAddr := fmt.Sprintf("0.0.0.0:%s", lunarEnginePort)
	listener, err := network.NewSPOEListener("tcp", spoeListeningAddr)
	defer network.CloseListener(listener)

	agent := agent.New(routing.Handler(handlingDataMng), logger.NewDefaultLog())

	statusMsg.Notify()
	log.Info().Msg("🚀 Lunar Proxy is up and running")
	if err := agent.Serve(listener); err != nil {
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
