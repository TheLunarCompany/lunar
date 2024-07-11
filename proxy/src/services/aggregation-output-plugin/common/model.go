package common

import (
	"errors"
	sharedActions "lunar/shared-model/actions"
	sharedConfig "lunar/shared-model/config"
)

var ErrCouldNotDumpCombinedAgg = errors.New(
	"Could not dump combined aggregation",
)

type (
	RequestActiveRemedies  map[sharedConfig.RemedyType][]sharedActions.RemedyReqRunResult
	ResponseActiveRemedies map[sharedConfig.RemedyType][]sharedActions.RemedyRespRunResult
)

type AccessLog struct {
	Timestamp              int64                  `json:"timestamp"`
	Duration               int                    `json:"duration"`
	StatusCode             int                    `json:"status_code"`
	Method                 string                 `json:"method"`
	Host                   string                 `json:"host"`
	URL                    string                 `json:"url"`
	RequestActiveRemedies  RequestActiveRemedies  `json:"request_active_remedies"`
	ResponseActiveRemedies ResponseActiveRemedies `json:"response_active_remedies"`
	Interceptor            string                 `json:"interceptor"`
	ConsumerTag            string                 `json:"consumer_tag"`
}

type KnownEndpoints struct {
	Endpoints []Endpoint `yaml:"endpoints"`
}

type Endpoint struct {
	Method string `json:"method" yaml:"method"`
	URL    string `json:"url"    yaml:"url"`
}

type Interceptor struct {
	Type    string `json:"type"`
	Version string `json:"version"`
}
