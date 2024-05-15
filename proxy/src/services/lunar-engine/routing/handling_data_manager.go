package routing

import (
	"context"
	"fmt"
	"lunar/engine/config"
	"lunar/engine/runner"
	"lunar/engine/services"
	"lunar/engine/streams"
	"lunar/engine/utils/environment"
	"lunar/engine/utils/writers"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/otel"
	"net/http"
	"time"

	sharedConfig "lunar/shared-model/config"

	"github.com/rs/zerolog/log"
)

const (
	lunarEngine            string = "lunar-engine"
	syslogExporterEndpoint string = "127.0.0.1:5140"
)

type PoliciesData struct {
	diagnosisWorker   *runner.DiagnosisWorker
	configBuildResult config.BuildResult
	services          *services.Services
}

type StreamsData struct {
	stream *streams.Stream
}

type HandlingDataManager struct {
	PoliciesData
	StreamsData

	isStreamsEnabled bool
	ctx              context.Context
	clock            clock.Clock
	writer           writers.Writer
	proxyTimeout     time.Duration

	shutdown func()
}

func NewHandlingDataManager(
	ctx context.Context,
	clock clock.Clock,
	proxyTimeout time.Duration,
) *HandlingDataManager {
	data := &HandlingDataManager{
		ctx:          ctx,
		clock:        clock,
		proxyTimeout: proxyTimeout,
		writer:       writers.Dial("tcp", syslogExporterEndpoint, clock),
	}
	return data
}

func (rd *HandlingDataManager) initializeServices() error {
	services, err := services.Initialize(rd.ctx, rd.clock, rd.writer, rd.proxyTimeout)
	if err != nil {
		return err
	}
	rd.services = services
	return nil
}

func (rd *HandlingDataManager) usePolicies() error {
	log.Info().Msg("Using policies for Lunar Engine")
	sharedConfig.Validate.RegisterStructValidation(
		config.ValidateStructLevel,
		sharedConfig.Remedy{},         //nolint: exhaustruct
		sharedConfig.Diagnosis{},      //nolint: exhaustruct
		sharedConfig.PoliciesConfig{}, //nolint: exhaustruct
	)
	err := sharedConfig.Validate.RegisterValidation("validateInt", config.ValidateInt)
	if err != nil {
		return fmt.Errorf("failed to register config validation: %w", err)
	}

	configBuildResult, err := config.BuildInitialFromFile(rd.clock)
	if err != nil {
		return fmt.Errorf("failed to build initial config: %w", err)
	}
	rd.configBuildResult = configBuildResult
	rd.diagnosisWorker = runner.NewDiagnosisWorker(rd.clock)

	rd.shutdown = otel.InitProvider(rd.ctx, lunarEngine, rd.configBuildResult.Initial.Config.Exporters)

	go otel.ServeMetrics()

	if err = rd.initializeServices(); err != nil {
		return fmt.Errorf("failed to initialize services: %w", err)
	}

	return nil
}

func (rd *HandlingDataManager) Setup() error {
	if environment.IsStreamsEnabled() {
		return rd.useStreams()
	}
	return rd.usePolicies()
}

func (rd *HandlingDataManager) useStreams() error {
	log.Info().Msg("Using streams for Lunar Engine")

	stream := streams.NewStream()
	if err := stream.Initialize(); err != nil {
		return fmt.Errorf("failed to initialize streams: %w", err)
	}
	rd.stream = stream
	rd.isStreamsEnabled = true

	go otel.ServeMetrics()

	return nil
}

func (rd *HandlingDataManager) RunDiagnosisWorker() {
	if rd.diagnosisWorker == nil {
		return
	}
	rd.diagnosisWorker.Run(
		rd.configBuildResult.Accessor,
		&rd.services.Diagnosis,
		&rd.services.Exporters,
	)
}

func (rd *HandlingDataManager) StopDiagnosisWorker() {
	if rd.diagnosisWorker != nil {
		rd.diagnosisWorker.Stop()
	}
}

func (rd *HandlingDataManager) GetTxnPoliciesAccessor() *config.TxnPoliciesAccessor {
	return rd.configBuildResult.Accessor
}

func (rd *HandlingDataManager) IsStreamsEnabled() bool {
	return rd.isStreamsEnabled
}

func (rd *HandlingDataManager) Shutdown() {
	if rd.shutdown != nil {
		rd.shutdown()
	}
}

func (rd *HandlingDataManager) SetHandleRoutes(mux *http.ServeMux) {
	if !rd.isStreamsEnabled {
		mux.HandleFunc(
			"/apply_policies",
			HandleApplyPolicies(
				rd.configBuildResult.Accessor,
				rd.writer),
		)
		mux.HandleFunc(
			"/validate_policies",
			HandleValidatePolicies(),
		)
	}

	mux.HandleFunc(
		"/discover",
		HandleJSONFileRead(environment.GetDiscoveryStateLocation()),
	)

	mux.HandleFunc(
		"/remedy_stats",
		HandleJSONFileRead(environment.GetRemedyStateLocation()),
	)

	mux.HandleFunc(
		"/handshake",
		HandleHandshake(),
	)
}
