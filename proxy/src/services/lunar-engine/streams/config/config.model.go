package streamconfig

import "lunar/engine/config"

type ConfigurationPayload struct {
	Metrics             string `json:"metrics,omitempty"`
	parsedMetrics       []byte
	GatewayConfig       string `json:"gateway_config,omitempty"`
	parsedGatewayConfig []byte
	Flows               map[string]string `json:"flows,omitempty"`
	parsedFlows         map[string][]byte
	Quotas              map[string]string `json:"quotas,omitempty"`
	parsedQuotas        map[string][]byte
	PathParams          map[string]string `json:"path_params,omitempty"`
	parsedPathParams    map[string][]byte
}

type ContractPayload struct {
	Operation *ContractOperation `json:"operation"`
}

type ContractResponsePayload struct {
	OperationResponse *ContractOperationResponse `json:"operation_response"`
}

type ContractOperationI interface {
	ParsePayload() error
	Apply(*config.FileSystemOperation) (*ContractResponsePayload, error)
}

type ContractOperation struct {
	Get    *GetOperation    `json:"get,omitempty"`
	Init   *InitOperation   `json:"init,omitempty"`
	Update *WriteOperation  `json:"update,omitempty"`
	Delete *DeleteOperation `json:"delete,omitempty"`
}

type WriteOperation struct {
	ConfigurationPayload
}

type InitOperation struct{}

type GetOperation struct{}

type DeleteOperation struct {
	All             bool     `json:"all,omitempty"`
	Flows           bool     `json:"flows,omitempty"`
	FlowByName      []string `json:"flow_by_name,omitempty"`
	Quotas          bool     `json:"quotas,omitempty"`
	QuotaByName     []string `json:"quota_by_name,omitempty"`
	PathParams      bool     `json:"path_params,omitempty"`
	PathParamByName []string `json:"path_param_by_name,omitempty"`
	GatewayConfig   bool     `json:"gateway_config,omitempty"`
	Metrics         bool     `json:"metrics,omitempty"`
}

type ContractOperationResponse struct {
	Get    *GetOperationResponse `json:"get,omitempty"`
	Init   *ContractResponse     `json:"init,omitempty"`
	Update *ContractResponse     `json:"update,omitempty"`
	Delete *ContractResponse     `json:"delete,omitempty"`
}

type ContractResponse struct {
	Status string   `json:"status"`
	Errors []string `json:"errors"`
}

type GetOperationResponsePayload struct {
	Name          string                `json:"name,omitempty"`
	Configuration *ConfigurationPayload `json:"configuration,omitempty"`
}

type GetOperationResponse struct {
	*ContractResponse
	Configurations []*GetOperationResponsePayload `json:"configurations,omitempty"`
}
