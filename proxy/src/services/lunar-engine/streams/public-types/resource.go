package publictypes

type QuotaMetaDataI interface {
	GetID() string
	GetFilter() FilterI
}

type ResourceManagementI interface {
	GetQuota(string) (QuotaResourceI, error)
	UpdateQuota(string, QuotaMetaDataI) error
}

type (
	QuotaResourceI    interface{}
	ResourceFlowDataI interface {
		GetFilter() FilterI
		GetProcessorsConnections() ResourceFlowI
		GetProcessors() map[string]ProcessorDataI
		GetID() string
	}
)

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
