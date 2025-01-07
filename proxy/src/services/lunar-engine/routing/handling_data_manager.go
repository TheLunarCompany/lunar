package routing

import (
	"fmt"
	"lunar/engine/communication"
	"lunar/engine/config"
	"lunar/engine/doctor"
	"lunar/engine/failsafe"
	"lunar/engine/metrics"
	"lunar/engine/runner"
	"lunar/engine/services"
	"lunar/engine/streams"
	internalTypes "lunar/engine/streams/internal-types"
	lunarContext "lunar/engine/streams/lunar-context"
	"lunar/engine/streams/validation"
	"lunar/engine/utils"
	"lunar/engine/utils/environment"
	"lunar/engine/utils/writers"
	"lunar/toolkit-core/logging"
	"lunar/toolkit-core/network"
	"lunar/toolkit-core/otel"
	"net/http"
	"time"

	contextManager "lunar/toolkit-core/context-manager"

	sharedConfig "lunar/shared-model/config"

	"github.com/rs/zerolog/log"
	"github.com/samber/lo"
)

const (
	lunarEngine            string = "lunar-engine"
	syslogExporterEndpoint string = "127.0.0.1:5140"
)

type PoliciesData struct {
	diagnosisWorker   *runner.DiagnosisWorker
	configBuildResult config.BuildResult
	diagnosisWatcher  *failsafe.StateChangeWatcher
}

type StreamsData struct {
	stream        *streams.Stream
	flowValidator *validation.Validator
}

type HandlingDataManager struct {
	PoliciesData
	StreamsData

	isStreamsEnabled bool
	lunarHub         *communication.HubCommunication
	writer           writers.Writer
	proxyTimeout     time.Duration
	policiesServices *services.PoliciesServices

	metricManager       *metrics.MetricManager
	legacyMetricManager *metrics.LegacyMetricManager
	doctor              *doctor.Doctor

	shutdown              func()
	areMetricsInitialized bool
}

func NewHandlingDataManager(
	proxyTimeout time.Duration,
	hubComm *communication.HubCommunication,
) *HandlingDataManager {
	ctxMng := contextManager.Get()
	data := &HandlingDataManager{
		proxyTimeout: proxyTimeout,
		lunarHub:     hubComm,
		writer:       writers.Dial("tcp", syslogExporterEndpoint, ctxMng.GetClock()),
	}
	return data
}

func (rd *HandlingDataManager) Setup(telemetryWriter *logging.LunarTelemetryWriter) error {
	rd.initializeOtel()

	err := rd.initializeDoctor(telemetryWriter)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to initialize doctor")
	}

	if environment.IsStreamsEnabled() {
		rd.isStreamsEnabled = true

		rd.doctor.WithStreams(rd.GetLoadedStreamsConfig)
		err := rd.initializeStreams()
		if err != nil {
			return err
		}

		rd.metricManager, err = metrics.NewMetricManager()
		if err != nil {
			return fmt.Errorf("failed to initialize metric manager: %w", err)
		}
		rd.metricManager.UpdateMetricsForFlow(rd.stream)
		return nil
	}
	rd.doctor.WithPolicies(rd.GetTxnPoliciesAccessor)

	return rd.initializePolicies()
}

func (rd *HandlingDataManager) GetMetricManager() *metrics.MetricManager {
	return rd.metricManager
}

func (rd *HandlingDataManager) RunDiagnosisWorker() {
	if rd.diagnosisWorker == nil {
		return
	}
	rd.diagnosisWorker.Run(
		rd.configBuildResult.Accessor,
		&rd.policiesServices.Diagnosis,
		&rd.policiesServices.Exporters,
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

func (rd *HandlingDataManager) GetLoadedStreamsConfig() *network.ConfigurationData {
	if rd.isStreamsEnabled && rd.stream != nil {
		f := rd.stream.GetLoadedConfig()
		return &f
	}
	return nil
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
	if rd.isStreamsEnabled {
		mux.HandleFunc(
			"/load_flows",
			rd.handleFlowsLoading(),
		)
		mux.HandleFunc(
			"/validate_flows",
			rd.handleFlowsValidation(),
		)
	} else {
		mux.HandleFunc(
			"/apply_policies",
			HandleApplyPolicies(rd.configBuildResult.Accessor, rd.writer),
		)
		mux.HandleFunc(
			"/validate_policies",
			HandleValidatePolicies(),
		)
		mux.HandleFunc(
			"/revert_to_diagnosis_free",
			HandleRevertToDiagnosisFree(rd.configBuildResult.Accessor, rd.writer),
		)
		mux.HandleFunc(
			"/revert_to_last_loaded",
			HandleRevertToLastLoaded(rd.configBuildResult.Accessor, rd.writer),
		)
	}
	mux.HandleFunc(
		"/doctor",
		HandleDoctorRequest(rd.doctor),
	)
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

func (rd *HandlingDataManager) initializeOtel() {
	rd.shutdown = otel.InitProvider(lunarEngine)
	go otel.ServeMetrics()
	rd.areMetricsInitialized = true
}

func (rd *HandlingDataManager) initializeStreamsForDryRun() error {
	log.Info().Msg("Validating flows for Lunar Engine")

	rd.flowValidator = validation.NewValidator()
	return rd.flowValidator.Validate()
}

func (rd *HandlingDataManager) initializeStreams() (err error) {
	statusMsg := contextManager.Get().GetStatusMessage()
	statusMsg.AddMessage(lunarEngine, "Engine: Lunar Flows")
	_ = lunarContext.NewSharedState[int64]() // For Redis initialization
	var previousHaProxyReq *config.HAProxyEndpointsRequest
	if rd.stream != nil {
		previousHaProxyReq = rd.buildHAProxyFlowsEndpointsRequest()
	}

	stream, err := streams.NewStream()
	if err != nil {
		return fmt.Errorf("failed to create stream: %w", err)
	}
	rd.stream = stream
	rd.stream.WithHub(rd.lunarHub)
	if err = rd.stream.Initialize(); err != nil {
		return fmt.Errorf("failed to initialize streams: %w", err)
	}

	rd.stream.InitializeHubCommunication()
	if err = config.WaitForProxyHealthcheck(); err != nil {
		return fmt.Errorf("failed to wait for HAProxy healthcheck: %w", err)
	}

	newHAProxyEndpoints := rd.buildHAProxyFlowsEndpointsRequest()

	err = config.ManageHAProxyEndpoints(newHAProxyEndpoints)
	if err != nil {
		return fmt.Errorf("failed to initialize HAProxy endpoints: %v", err)
	}

	// Unmanaging HAProxy endpoints should occur after all possible transactions have reached Engine
	if previousHaProxyReq != nil &&
		len(previousHaProxyReq.ManagedEndpoints) > 0 {
		haproxyEndpointsToRemove, _ := lo.Difference(
			previousHaProxyReq.ManagedEndpoints,
			newHAProxyEndpoints.ManagedEndpoints,
		)
		config.ScheduleUnmanageHAProxyEndpoints(haproxyEndpointsToRemove)
	}
	return nil
}

func (rd *HandlingDataManager) processFlowsValidation(writer http.ResponseWriter) bool {
	err := rd.initializeStreamsForDryRun()
	if err != nil {
		err = utils.LastErrorWithUnwrappedDepth(err, 1)
		handleError(writer,
			fmt.Sprintf("💔 Validation failed: %v", err.Error()),
			http.StatusUnprocessableEntity, err)
		return false
	}
	return true
}

func (rd *HandlingDataManager) handleFlowsLoading() func(http.ResponseWriter, *http.Request) {
	return func(writer http.ResponseWriter, req *http.Request) {
		switch req.Method {
		case http.MethodPost:
			if !rd.processFlowsValidation(writer) {
				return
			}

			err := rd.initializeStreams()
			if err != nil {
				handleError(writer,
					fmt.Sprintf("💔 Failed to load flows: %v", err),
					http.StatusUnprocessableEntity, err)
				return
			}
			err = rd.metricManager.ReloadMetricsConfig()
			if err != nil {
				handleError(writer,
					fmt.Sprintf("Failed to load metrics config: %v", err),
					http.StatusUnprocessableEntity, err)
				return
			}

			rd.metricManager.UpdateMetricsForFlow(rd.stream)
			SuccessResponse(writer, "✅ Successfully loaded flows")
		default:
			http.Error(
				writer,
				"Unsupported Method",
				http.StatusMethodNotAllowed,
			)
		}
	}
}

func (rd *HandlingDataManager) handleFlowsValidation() func(http.ResponseWriter, *http.Request) {
	return func(writer http.ResponseWriter, req *http.Request) {
		switch req.Method {
		case http.MethodPost:
			if !rd.processFlowsValidation(writer) {
				return
			}
			SuccessResponse(writer, "✅ Validation succeeded")
		default:
			http.Error(
				writer,
				"Unsupported Method",
				http.StatusMethodNotAllowed,
			)
		}
	}
}

func (rd *HandlingDataManager) initializePolicies() error {
	statusMsg := contextManager.Get().GetStatusMessage()
	statusMsg.AddMessage(lunarEngine, "Engine: Lunar Policies")

	sharedConfig.Validate.RegisterStructValidation(
		config.ValidateStructLevel,
		sharedConfig.Remedy{},         //nolint: exhaustruct
		sharedConfig.Diagnosis{},      //nolint: exhaustruct
		sharedConfig.PoliciesConfig{}, //nolint: exhaustruct
	)
	err := sharedConfig.Validate.RegisterValidation(
		"validateInt",
		config.ValidateInt,
	)
	if err != nil {
		return fmt.Errorf("failed to register config validation: %w", err)
	}

	configBuildResult, err := config.BuildInitialFromFile()
	if err != nil {
		return fmt.Errorf("failed to build initial config: %w", err)
	}
	rd.configBuildResult = configBuildResult
	rd.diagnosisWorker = runner.NewDiagnosisWorker()

	exporters := rd.configBuildResult.Initial.Config.Exporters
	rd.policiesServices, err = services.Initialize(rd.writer, rd.proxyTimeout, exporters)
	if err != nil {
		return fmt.Errorf("failed to initialize services: %w", err)
	}

	legacyMetricsCollectedByPlugin := false
	for _, dig := range rd.configBuildResult.Initial.Config.Global.Diagnosis {
		if dig.Config.MetricsCollector != nil {
			legacyMetricsCollectedByPlugin = true
			log.Info().Msg("Legacy metrics will be collected by plugin")
			break
		}
	}
	if !legacyMetricsCollectedByPlugin {
		log.Info().Msg("Legacy metrics will be collected by Lunar Engine")

		rd.legacyMetricManager, err = metrics.NewLegacyMetricManager(exporters)
		if err != nil {
			log.Error().Err(err).Msg("Failed to initialize legacy metric manager")
		}
	}
	ctxMng := contextManager.Get()
	watcher, err := failsafe.NewDiagnosisFailsafeStateChangeWatcher(
		rd.GetTxnPoliciesAccessor(),
		ctxMng.GetClock(),
	)
	rd.diagnosisWatcher = watcher
	if err != nil {
		log.Panic().
			Stack().
			Err(err).
			Msg("Could not create diagnosis failsafe state change watcher")
	}
	rd.diagnosisWatcher.RunInBackground()

	return nil
}

func (rd *HandlingDataManager) buildHAProxyFlowsEndpointsRequest() *config.HAProxyEndpointsRequest {
	if !rd.isStreamsEnabled {
		return &config.HAProxyEndpointsRequest{}
	}
	manageAll := false
	bodyMessageForAll := false

	managedEndpoints := []*config.HAProxyEndpointData{}
	for _, filters := range rd.stream.GetSupportedFilters() {
		if len(filters) == 0 {
			continue
		}
		isBodyRequired := false
		for _, filter := range filters {
			adminFilter := filter.(internalTypes.FlowFilterI)
			// If any filter requires body, we will set the flag to true
			isBodyRequired = isBodyRequired || adminFilter.IsBodyRequired()
			manageAll = manageAll || filter.IsAnyURLAccepted()
			bodyMessageForAll = bodyMessageForAll || (manageAll && isBodyRequired)
		}

		for _, method := range filters[0].GetSupportedMethods() {
			managedEndpoints = append(managedEndpoints,
				config.HaproxyEndpointFormat(method, filters[0].GetURL(), isBodyRequired))
		}
	}

	return &config.HAProxyEndpointsRequest{
		ManageAll:        manageAll,
		BodyNeededForAll: bodyMessageForAll,
		ManagedEndpoints: managedEndpoints,
	}
}

func (rd *HandlingDataManager) initializeDoctor(
	telemetryWriter *logging.LunarTelemetryWriter,
) error {
	ctxManager := contextManager.Get()
	getLastSuccessfulHubCommunication := func() *time.Time {
		return nil
	}
	if rd.lunarHub != nil {
		getLastSuccessfulHubCommunication = func() *time.Time {
			return rd.lunarHub.LastSuccessfulCommunication()
		}
	}
	doctorInstance, err := doctor.NewDoctor(
		ctxManager.GetContext(),
		getLastSuccessfulHubCommunication,
		ctxManager.GetClock(),
		log.Logger,
	)
	statusMsg := contextManager.Get().GetStatusMessage()
	if err != nil {
		statusMsg.AddMessage(lunarEngine, "Doctor: Initialization failed")
		return err
	}
	// Set-up periodic reports
	doctorReportInterval, err := environment.GetDoctorReportInterval()
	if err != nil {
		log.Warn().
			Stack().
			Err(err).
			Msgf("Could not get doctor report interval, will use default of %v",
				environment.DoctorReportIntervalDefault)
		doctorReportInterval = environment.DoctorReportIntervalDefault
	}
	if doctorReportInterval > doctor.MaxDoctorReportInterval {
		log.Warn().
			Msgf("Doctor report interval (%v) is too high, setting it to %v",
				doctorReportInterval, doctor.MaxDoctorReportInterval)
		doctorReportInterval = doctor.MaxDoctorReportInterval
	}

	doctor.ReportPeriodicallyInBackground(
		doctorInstance,
		doctorReportInterval,
		telemetryWriter,
		ctxManager.GetClock(),
	)

	statusMsg.AddMessage(lunarEngine, "Doctor: Initialized")
	rd.doctor = doctorInstance
	return nil
}
