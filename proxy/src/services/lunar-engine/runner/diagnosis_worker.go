package runner

import (
	"lunar/engine/config"
	"lunar/engine/messages"
	"lunar/engine/services"
	"lunar/engine/utils"
	sharedConfig "lunar/shared-model/config"
	contextmanager "lunar/toolkit-core/context-manager"
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
}

const (
	// cacheTTL: The time that the data will be stored in the cache
	// before being deleted. The default will be 2 minutes.
	cacheTTL float64 = 60 * 2
	// channelBufferSize: The size of the channel buffer,
	// the number of messages that can be stored without blocking the flow.
	channelBufferSize int = 2048
)

func NewDiagnosisWorker() *DiagnosisWorker {
	return &DiagnosisWorker{
		diagnosisCache: utils.NewMemoryCache[string, DiagnosisTask](contextmanager.Get().GetClock()),
		diagnosisData:  make(chan string, channelBufferSize),
	}
}

func (worker *DiagnosisWorker) AddRequestToTask(onRequest messages.OnRequest) {
	var emptyResponse messages.OnResponse

	cacheKey := strings.Clone(onRequest.ID)
	log.Trace().Msgf("Adding request data to the cache with key: %v", cacheKey)

	err := worker.diagnosisCache.Set(
		cacheKey,
		DiagnosisTask{Request: onRequest.DeepCopy(), Response: emptyResponse},
		cacheTTL)
	if err != nil {
		log.Debug().
			Msgf("Failed to cache key: %v, cache: %+v. %+v",
				cacheKey, worker.diagnosisCache, err)
		return
	}
	log.Trace().Msgf("Cache after adding request: %+v", worker.diagnosisCache)
}

func (worker *DiagnosisWorker) AddResponseToTask(
	onResponse messages.OnResponse,
) {
	cacheKey := strings.Clone(onResponse.ID)
	task, found := worker.diagnosisCache.Get(cacheKey)

	if !found {
		log.Debug().
			Msgf("Failed to find transaction for key: %v, cache: %+v",
				cacheKey, worker.diagnosisCache)
		return
	}

	task.Response = onResponse.DeepCopy()
	log.Trace().Msgf(
		"Adding response data to the cache with key: %v, value: %+v",
		cacheKey,
		task.Response,
	)

	err := worker.diagnosisCache.Set(cacheKey, task, cacheTTL)
	if err != nil {
		log.Debug().
			Msgf("Failed to cache key: %v, cache: %+v. %+v",
				cacheKey, worker.diagnosisCache, err)
		return
	}

	log.Trace().Msgf("Cache after adding response: %+v", worker.diagnosisCache)
}

func (worker *DiagnosisWorker) NotifyTaskReady(transactionID string) {
	// This is executed in a separate goroutine
	// to avoid blocking the flow if the channel is full.
	log.Trace().Msgf(
		"Scheduling goroutine to send %v to diagnosis worker", transactionID)
	copyOfTransactionID := strings.Clone(transactionID)
	go func(transactionID string) {
		log.Trace().Msgf("Sending %v to diagnosis worker", transactionID)
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
	log.Trace().Msg("Stopping the Diagnosis Worker...")
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
			sublogger.Warn().Msgf(
				"Failed to find transaction for key: %v",
				taskKey,
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
