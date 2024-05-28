package processorbasicratelimiter

import (
	"fmt"
	"lunar/engine/actions"
	"lunar/engine/streams/processors/utils"
	streamtypes "lunar/engine/streams/types"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/logging"
	"time"

	"github.com/rs/zerolog/log"
)

const (
	belowQuotaConditionName = "belowQuota"
	aboveQuotaConditionName = "aboveQuota"
)

type basicRateLimiterProcessor struct {
	name                string
	allowedRequestCount int64
	windowSizeSeconds   int
	rateLimitState      *rateLimitState
	metaData            *streamtypes.ProcessorMetaData
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.Processor, error) {
	proc := &basicRateLimiterProcessor{
		name:     metaData.Name,
		metaData: metaData,
	}

	if err := utils.ExtractNumericParam(metaData.Parameters,
		"allowed_request_count",
		&proc.allowedRequestCount); err != nil {
		return nil, err
	}

	if err := utils.ExtractNumericParam(metaData.Parameters,
		"window_size_in_seconds",
		&proc.windowSizeSeconds); err != nil {
		return nil, err
	}

	clock := clock.NewRealClock()
	contextLogger := logging.ContextLogger{Logger: log.Logger}
	proc.rateLimitState = newRateLimitState(clock, contextLogger)

	return proc, nil
}

func (p *basicRateLimiterProcessor) GetName() string {
	return p.name
}

func (p *basicRateLimiterProcessor) Execute(
	apiStream *streamtypes.APIStream,
) (streamtypes.ProcessorIO, error) {
	if apiStream.Type == streamtypes.StreamTypeRequest {
		return p.onRequest(apiStream)
	}

	return streamtypes.ProcessorIO{}, fmt.Errorf("invalid stream type: %s", apiStream.Type)
}

func (p *basicRateLimiterProcessor) onRequest(
	apiStream *streamtypes.APIStream,
) (streamtypes.ProcessorIO, error) {
	requestArgs := requestArguments{
		LimiterID: p.name,
	}

	winData := windowData{
		WindowSize:           time.Duration(p.windowSizeSeconds) * time.Second,
		AllowedRequestCount:  p.allowedRequestCount,
		QuotaAllocationRatio: float64(1),
	}

	currentLimitState, err := p.rateLimitState.TryToIncrement(requestArgs, winData)
	if err != nil {
		return streamtypes.ProcessorIO{}, fmt.Errorf("error incrementing rate limit: %w", err)
	}

	if log.Trace().Enabled() {
		log.Trace().Msgf(
			"Rate limit counter for %v %v: %v",
			apiStream.Request.Method,
			apiStream.Request.URL,
			currentLimitState.NewCounter,
		)
	}

	condition := belowQuotaConditionName
	var action actions.ReqLunarAction = &actions.NoOpAction{}
	if currentLimitState.LimitSate == Block {
		condition = aboveQuotaConditionName
	}

	return streamtypes.ProcessorIO{
		Type:      streamtypes.StreamTypeRequest,
		ReqAction: action,
		Name:      condition,
	}, nil
}
