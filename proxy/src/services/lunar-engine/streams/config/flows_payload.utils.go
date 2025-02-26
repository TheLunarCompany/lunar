package streamconfig

import (
	"encoding/base64"
	"lunar/engine/config"
)

func NewApplyFlowsPayload() *ApplyFlowsPayload {
	return &ApplyFlowsPayload{
		Flows:               nil,
		Quotas:              nil,
		PathParams:          nil,
		GatewayConfig:       "",
		Metrics:             "",
		parsedFlows:         make(map[string][]byte),
		parsedQuotas:        make(map[string][]byte),
		parsedPathParams:    make(map[string][]byte),
		parsedGatewayConfig: nil,
		parsedMetrics:       nil,
	}
}

func (applyFlows *ApplyFlowsPayload) ParsePayload() error {
	if err := applyFlows.parseFlows(); err != nil {
		return err
	}

	if err := applyFlows.parseQuotas(); err != nil {
		return err
	}

	if err := applyFlows.parsePathParams(); err != nil {
		return err
	}

	if err := applyFlows.parseGatewayConfig(); err != nil {
		return err
	}

	return applyFlows.parseMetricsConfig()
}

func (applyFlows *ApplyFlowsPayload) CleanUpGatewayDirectories(
	fileSysOp *config.FileSystemOperation,
) error {
	return fileSysOp.CleanAll()
}

func (applyFlows *ApplyFlowsPayload) MakeCleanUpsByContent(
	fileSysOp *config.FileSystemOperation,
) error {
	if applyFlows.isFlowSpecified() {
		if err := fileSysOp.CleanFlowsDirectory(); err != nil {
			return err
		}
	}

	if applyFlows.isQuotaSpecified() {
		if err := fileSysOp.CleanQuotasDirectory(); err != nil {
			return err
		}
	}

	if applyFlows.isPathParamsSpecified() {
		if err := fileSysOp.CleanPathParamsDirectory(); err != nil {
			return err
		}
	}

	if applyFlows.isGatewayConfigSpecified() {
		if err := fileSysOp.CleanGatewayConfigFile(); err != nil {
			return err
		}
	}

	if applyFlows.isMetricsConfigSpecified() {
		if err := fileSysOp.CleanMetricsConfigFile(); err != nil {
			return err
		}
	}
	return nil
}

func (applyFlows *ApplyFlowsPayload) SavePayloadContentToDisk(
	fileSysOp *config.FileSystemOperation,
) error {
	if err := applyFlows.saveFlows(fileSysOp); err != nil {
		return err
	}

	if err := applyFlows.saveQuotas(fileSysOp); err != nil {
		return err
	}

	if err := applyFlows.savePathParams(fileSysOp); err != nil {
		return err
	}

	if err := applyFlows.saveGatewayConfig(fileSysOp); err != nil {
		return err
	}

	return applyFlows.saveMetricsConfig(fileSysOp)
}

func (applyFlows *ApplyFlowsPayload) GetFlows() (map[string]string, bool) {
	return applyFlows.Flows, applyFlows.isFlowSpecified()
}

func (applyFlows *ApplyFlowsPayload) GetQuotas() (map[string]string, bool) {
	return applyFlows.Quotas, applyFlows.isQuotaSpecified()
}

func (applyFlows *ApplyFlowsPayload) GetPathParams() (map[string]string, bool) {
	return applyFlows.PathParams, applyFlows.isPathParamsSpecified()
}

func (applyFlows *ApplyFlowsPayload) GetGatewayConfig() (string, bool) {
	return applyFlows.GatewayConfig, applyFlows.isGatewayConfigSpecified()
}

func (applyFlows *ApplyFlowsPayload) GetMetricsConfig() (string, bool) {
	return applyFlows.Metrics, applyFlows.isMetricsConfigSpecified()
}

func (applyFlows *ApplyFlowsPayload) isFlowSpecified() bool {
	return applyFlows.Flows != nil
}

func (applyFlows *ApplyFlowsPayload) isQuotaSpecified() bool {
	return applyFlows.Quotas != nil
}

func (applyFlows *ApplyFlowsPayload) isPathParamsSpecified() bool {
	return applyFlows.PathParams != nil
}

func (applyFlows *ApplyFlowsPayload) isGatewayConfigSpecified() bool {
	return applyFlows.GatewayConfig != ""
}

func (applyFlows *ApplyFlowsPayload) isMetricsConfigSpecified() bool {
	return applyFlows.Metrics != ""
}

func (applyFlows *ApplyFlowsPayload) parseFlows() error {
	if !applyFlows.isFlowSpecified() {
		return nil
	}

	for name, content := range applyFlows.Flows {
		decodedContent, err := base64.StdEncoding.DecodeString(content)
		if err != nil {
			return err
		}

		applyFlows.parsedFlows[name] = decodedContent
	}
	return nil
}

func (applyFlows *ApplyFlowsPayload) saveFlows(fileSysOp *config.FileSystemOperation) error {
	if !applyFlows.isFlowSpecified() {
		return nil
	}

	for name, content := range applyFlows.parsedFlows {
		if err := fileSysOp.SaveFlow(name, content); err != nil {
			return err
		}
	}
	return nil
}

func (applyFlows *ApplyFlowsPayload) parseQuotas() error {
	if !applyFlows.isQuotaSpecified() {
		return nil
	}

	for name, content := range applyFlows.Quotas {
		decodedContent, err := base64.StdEncoding.DecodeString(content)
		if err != nil {
			return err
		}

		applyFlows.parsedQuotas[name] = decodedContent
	}
	return nil
}

func (applyFlows *ApplyFlowsPayload) saveQuotas(fileSysOp *config.FileSystemOperation) error {
	if !applyFlows.isQuotaSpecified() {
		return nil
	}

	for name, content := range applyFlows.parsedQuotas {
		if err := fileSysOp.SaveQuota(name, content); err != nil {
			return err
		}
	}
	return nil
}

func (applyFlows *ApplyFlowsPayload) parsePathParams() error {
	if !applyFlows.isPathParamsSpecified() {
		return nil
	}

	for name, content := range applyFlows.PathParams {
		decodedContent, err := base64.StdEncoding.DecodeString(content)
		if err != nil {
			return err
		}

		applyFlows.parsedPathParams[name] = decodedContent
	}
	return nil
}

func (applyFlows *ApplyFlowsPayload) savePathParams(fileSysOp *config.FileSystemOperation) error {
	if !applyFlows.isPathParamsSpecified() {
		return nil
	}

	for name, content := range applyFlows.parsedPathParams {
		if err := fileSysOp.SavePathParams(name, content); err != nil {
			return err
		}
	}
	return nil
}

func (applyFlows *ApplyFlowsPayload) parseGatewayConfig() error {
	if !applyFlows.isGatewayConfigSpecified() {
		return nil
	}

	decodedContent, err := base64.StdEncoding.DecodeString(applyFlows.GatewayConfig)
	if err != nil {
		return err
	}

	applyFlows.parsedGatewayConfig = decodedContent
	return nil
}

func (applyFlows *ApplyFlowsPayload) saveGatewayConfig(
	fileSysOp *config.FileSystemOperation,
) error {
	if !applyFlows.isGatewayConfigSpecified() {
		return nil
	}

	return fileSysOp.SaveGatewayConfig(applyFlows.parsedGatewayConfig)
}

func (applyFlows *ApplyFlowsPayload) parseMetricsConfig() error {
	if !applyFlows.isMetricsConfigSpecified() {
		return nil
	}

	decodedContent, err := base64.StdEncoding.DecodeString(applyFlows.Metrics)
	if err != nil {
		return err
	}

	applyFlows.parsedMetrics = decodedContent
	return nil
}

func (applyFlows *ApplyFlowsPayload) saveMetricsConfig(
	fileSysOp *config.FileSystemOperation,
) error {
	if !applyFlows.isMetricsConfigSpecified() {
		return nil
	}

	return fileSysOp.SaveMetricsConfig(applyFlows.parsedMetrics)
}
