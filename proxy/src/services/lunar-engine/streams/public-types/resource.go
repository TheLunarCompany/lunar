package publictypes

import "time"

type QuotaMetaDataI interface {
	GetID() string
	GetFilter() FilterI
	IsValid() error
}

type ResourceManagementI interface {
	GetQuota(string, string) (QuotaResourceI, error)
	OnRequestDrop(APIStreamI)
	OnRequestFinish(APIStreamI)
}

type QuotaResourceI interface {
	Allowed(APIStreamI) (bool, error)
	Dec(APIStreamI) error
	Inc(APIStreamI) error
	ResetIn() time.Duration
	GetParentID() string
}

type ResourceFlowDataI interface {
	GetFilter() FilterI
	GetProcessorsConnections() ResourceFlowI
	GetProcessors() map[string]ProcessorDataI
	GetID() string
}

type ResourceFlowI interface {
	GetRequest() ResourceProcessorLocationI
	GetResponse() ResourceProcessorLocationI
}

type ResourceProcessorLocationI interface {
	GetEnd() []string
	GetStart() []string
	AddConnections(ResourceProcessorLocationI)
	AddToStart([]string)
	AddToEnd([]string)
}
