package runner

import (
	"lunar/engine/config"
	"lunar/engine/messages"
	"lunar/engine/services"
	"lunar/engine/utils"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"runtime"
	"strings"

	"github.com/rs/zerolog/log"
)

type DiagnosisTask struct {
	Request  messages.OnRequest
	Response messages.OnResponse
}

type DiagnosisWorker struct {
	diagnosisCache utils.Cache[string, DiagnosisTask]
	diagnosisData  chan string
	clock          clock.Clock
}

const (
	// cacheTTL: The time that the data will be stored in the cache
	// before being deleted. The default will be 2 minutes.
	cacheTTL float64 = 60 * 2
	// channelBufferSize: The size of the channel buffer,
	// the number of messages that can be stored without blocking the flow.
	channelBufferSize int = 128
)

func NewDiagnosisWorker(clock clock.Clock) *DiagnosisWorker {
	return &DiagnosisWorker{
		diagnosisCache: utils.NewMemoryCache[string, DiagnosisTask](clock),
		diagnosisData:  make(chan string, channelBufferSize),
		clock:          clock,
	}
}

func (worker *DiagnosisWorker) AddRequestToTask(onRequest messages.OnRequest) {
	var emptyResponse messages.OnResponse

	cacheKey := strings.Clone(onRequest.ID)
	log.Debug().Msgf("Adding request data to the cache with key: %v",
		cacheKey)

	worker.diagnosisCache.Set(
		cacheKey,
		DiagnosisTask{Request: onRequest.DeepCopy(), Response: emptyResponse},
		cacheTTL)
	log.Debug().Msgf("Cache after adding request: %+v", worker.diagnosisCache)
}

func (worker *DiagnosisWorker) AddResponseToTask(
	onResponse messages.OnResponse,
) {
	cacheKey := strings.Clone(onResponse.ID)
	task, found := worker.diagnosisCache.Get(cacheKey)

	if !found {
		log.Warn().
			Msgf("Failed to find transaction for key: %v, cache: %+v",
				cacheKey, worker.diagnosisCache)
		return
	}

	task.Response = onResponse.DeepCopy()
	log.Debug().Msgf(
		"Adding response data to the cache with key: %v, value: %+v",
		cacheKey,
		task.Response,
	)

	worker.diagnosisCache.Set(cacheKey, task, cacheTTL)

	log.Debug().Msgf("Cache after adding response: %+v", worker.diagnosisCache)
}

func (worker *DiagnosisWorker) NotifyTaskReady(transactionID string) {
	// This is executed in a separate goroutine
	// to avoid blocking the flow if the channel is full.
	log.Debug().Msgf(
		"Scheduling goroutine to send %v to diagnosis worker", transactionID)
	copyOfTransactionID := strings.Clone(transactionID)
	go func(transactionID string) {
		log.Debug().Msgf("Sending %v to diagnosis worker", transactionID)
		worker.diagnosisData <- transactionID
	}(copyOfTransactionID)
}

func (worker *DiagnosisWorker) Run(
	policiesAccessor config.PoliciesAccessor,
	plugins *services.DiagnosisPlugins,
	exporters *services.Exporters,
) {
	go worker.diagnosisWorker(
		worker.diagnosisData,
		policiesAccessor,
		plugins,
		exporters,
	)
}

func (worker *DiagnosisWorker) Stop() {
	log.Info().Msg("Stopping the Diagnosis Worker...")
	close(worker.diagnosisData)
}

func (worker *DiagnosisWorker) diagnosisWorker(
	diagnosisTasks <-chan string,
	policiesAccessor config.PoliciesAccessor,
	plugins *services.DiagnosisPlugins,
	exporters *services.Exporters,
) {
	sublogger := log.With().
		Str("component", "diagnosis-worker").
		Logger() // TODO: How to share the logger down the call stack?

	for taskKey := range diagnosisTasks {
		task, found := worker.diagnosisCache.Get(taskKey)
		if !found {
			sublogger.Error().Msgf(
				"Failed to find transaction for key: %v, cache keys: %+v",
				taskKey,
				worker.diagnosisCache,
			)
		}

		policiesData := policiesAccessor.GetTxnPoliciesData(
			config.TxnID(taskKey),
		)

		RunTask(
			task,
			&policiesData.EndpointPolicyTree,
			policiesData.Config.Global.Diagnosis,
			plugins,
			exporters,
		)

		// Set the function as low priority to give more runtime to the remedy types.
		runtime.Gosched()
	}
}

func RunTask(
	task DiagnosisTask,
	policyTree *config.EndpointPolicyTree,
	globalDiagnoses []sharedConfig.Diagnosis,
	plugins *services.DiagnosisPlugins,
	exporters *services.Exporters,
) {
	diagnoses := getDiagnoses(
		task.Request.Method, task.Request.URL, policyTree, globalDiagnoses)

	runOnTransaction(
		task.Request,
		task.Response,
		diagnoses,
		plugins,
		exporters,
		policyTree,
	)
}
