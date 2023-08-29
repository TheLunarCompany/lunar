package main

import (
	"context"
	"fmt"
	"lunar/engine/config"
	"lunar/engine/routing"
	"lunar/engine/runner"
	"lunar/engine/services"
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
	"github.com/getsentry/sentry-go"
	"github.com/rs/zerolog/log"
)

const (
	policiesConfigEnvVar   string  = "LUNAR_PROXY_POLICIES_CONFIG"
	lunarEnginePort        string  = "12345"
	lunarEngine            string  = "lunar-engine"
	syslogExporterEndpoint string  = "127.0.0.1:5140"
	sentryTraceSampleRate  float64 = 1.0
)

var (
	adminPort                        = os.Getenv("ENGINE_ADMIN_PORT")
	serverProxyTimeoutSecondsEnvVar  = "LUNAR_SERVER_TIMEOUT_SEC"
	connectProxyTimeoutSecondsEnvVar = "LUNAR_CONNECT_TIMEOUT_SEC"
)

func main() {
	proxyTimeout, err := getProxyTimeout()
	if err != nil {
		log.Fatal().
			Stack().
			Err(err).
			Msg("Could not get proxy timeout")
	}

	clock := clock.NewRealClock()
	logger := logging.ConfigureLogger(lunarEngine, true, clock)
	if logger != nil {
		defer logger.Close()
	}

	env := environment.GetEnvironment()
	if environment.UseSentry(env) {
		tenantName := environment.GetTenantName()
		if tenantName == "" {
			log.Warn().Msgf("TENANT_NAME env var is not set")
			tenantName = "N/A"
		}

		err := setupSentry(tenantName, env)
		if err != nil {
			log.Error().Err(err).Msgf("Failed to initialize sentry")
		}

		log.Debug().Msgf("Sentry initialized")
		heartbeatInterval := getHeartbeatInterval()
		go periodicHeartbeat(clock, tenantName, heartbeatInterval)
	} else {
		log.Debug().Msgf("Sentry is disabled for environment [%v]",
			env.ToString())
	}

	ctx, cancelCtx := signal.NotifyContext(context.Background(), os.Interrupt)
	defer cancelCtx()

	var writer writers.Writer
	writer, err = writers.Dial("udp", syslogExporterEndpoint, clock)
	if err != nil {
		log.Error().Err(err).Msgf("Failed to open UDP connection, " +
			"exporting is disabled")
		writer = writers.NewNullWriter()
	}

	services := services.InitializeServices(clock, writer, proxyTimeout)
	diagnosisWorker := runner.NewDiagnosisWorker(clock)

	configBuildResult, err := config.BuildInitialFromFile(clock)
	if err != nil {
		log.Panic().Stack().Err(err).Msg("Failed to build policy tree")
	}
	txnPoliciesAccessor := configBuildResult.Accessor
	initialPoliciesData := configBuildResult.Initial

	shutdownOtel := otel.InitProvider(
		lunarEngine,
		initialPoliciesData.Config.Exporters,
	)

	go otel.ServeMetrics()

	defer shutdownOtel()

	mux := http.NewServeMux()
	mux.HandleFunc(
		"/apply_policies",
		routing.HandleApplyPolicies(txnPoliciesAccessor),
	)

	sharedConfig.Validate.RegisterStructValidation(config.ValidateStructLevel,
		sharedConfig.Remedy{}, sharedConfig.Diagnosis{}) //nolint:exhaustruct

	mux.HandleFunc(
		"/validate_policies",
		routing.HandleValidatePolicies(),
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

	if err := agent.
		ListenAndServe(fmt.Sprintf("0.0.0.0:%s", lunarEnginePort)); err != nil {
		diagnosisWorker.Stop()
		log.Fatal().
			Stack().
			Err(err).
			Msg("Could not bring up engine SPOE server")
	}
}

func getHeartbeatInterval() time.Duration {
	var heartbeatIntervalDuration time.Duration

	heartbeatInterval := environment.GetHeartbeatInterval()
	if result, err := time.ParseDuration(heartbeatInterval); err != nil {
		heartbeatIntervalDuration = 30 * time.Minute
		log.Warn().Err(err).
			Msgf("HEARTBEAT_INTERVAL environment variable value is invalid: %v,"+
				"using default value: %v", heartbeatInterval, heartbeatIntervalDuration)
	} else {
		heartbeatIntervalDuration = result
	}

	return heartbeatIntervalDuration
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

func setupSentry(tenantName string, environment environment.Environment) error {
	err := sentry.Init(sentry.ClientOptions{ //nolint: exhaustruct
		Dsn: "https://48e61d51a5c74b5e8174b9cc853bdb35@o4504834048458752.ingest.sentry.io/4504871259996160", //nolint: lll
		// Set TracesSampleRate to 1.0 to capture 100%
		// of transactions for performance monitoring.
		// We recommend adjusting this value in production,
		TracesSampleRate: sentryTraceSampleRate,
		Environment:      environment.ToString(),
	})
	if err != nil {
		return err
	}

	sentry.ConfigureScope(func(scope *sentry.Scope) {
		scope.SetTag("app_name", lunarEngine)
		scope.SetUser(sentry.User{ID: tenantName}) //nolint:exhaustruct
	})
	return nil
}

func periodicHeartbeat(
	clock clock.Clock,
	tenantID string,
	heartbeatInterval time.Duration,
) {
	for {
		log.Debug().Msg("Sending heartbeat...")
		sentry.CaptureMessage(fmt.Sprintf("🤍 Heartbeat [%v]", tenantID))
		log.Debug().Msg("🤍 Heartbeat sent")
		clock.Sleep(heartbeatInterval)
	}
}
