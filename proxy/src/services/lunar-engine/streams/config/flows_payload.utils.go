package streamconfig

import (
	"encoding/base64"
	"lunar/engine/config"
)

func NewConfigurationPayload() *ConfigurationPayload {
	return &ConfigurationPayload{
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

func (applyFlows *ConfigurationPayload) ParsePayload() error {
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

func (applyFlows *ConfigurationPayload) CleanUpGatewayDirectories(
	fileSysOp *config.FileSystemOperation,
) error {
	return fileSysOp.CleanAll()
}

func (applyFlows *ConfigurationPayload) MakeCleanUpsByContent(
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

func (applyFlows *ConfigurationPayload) SavePayloadContentToDisk(
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

func (applyFlows *ConfigurationPayload) GetFlows() (map[string]string, bool) {
	return applyFlows.Flows, applyFlows.isFlowSpecified()
}

func (applyFlows *ConfigurationPayload) GetQuotas() (map[string]string, bool) {
	return applyFlows.Quotas, applyFlows.isQuotaSpecified()
}

func (applyFlows *ConfigurationPayload) GetPathParams() (map[string]string, bool) {
	return applyFlows.PathParams, applyFlows.isPathParamsSpecified()
}

func (applyFlows *ConfigurationPayload) GetGatewayConfig() (string, bool) {
	return applyFlows.GatewayConfig, applyFlows.isGatewayConfigSpecified()
}

func (applyFlows *ConfigurationPayload) GetMetricsConfig() (string, bool) {
	return applyFlows.Metrics, applyFlows.isMetricsConfigSpecified()
}

func (applyFlows *ConfigurationPayload) isFlowSpecified() bool {
	return applyFlows.Flows != nil
}

func (applyFlows *ConfigurationPayload) isQuotaSpecified() bool {
	return applyFlows.Quotas != nil
}

func (applyFlows *ConfigurationPayload) isPathParamsSpecified() bool {
	return applyFlows.PathParams != nil
}

func (applyFlows *ConfigurationPayload) isGatewayConfigSpecified() bool {
	return applyFlows.GatewayConfig != ""
}

func (applyFlows *ConfigurationPayload) isMetricsConfigSpecified() bool {
	return applyFlows.Metrics != ""
}

func (applyFlows *ConfigurationPayload) parseFlows() error {
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

func (applyFlows *ConfigurationPayload) saveFlows(fileSysOp *config.FileSystemOperation) error {
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

func (applyFlows *ConfigurationPayload) parseQuotas() error {
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

func (applyFlows *ConfigurationPayload) saveQuotas(fileSysOp *config.FileSystemOperation) error {
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

func (applyFlows *ConfigurationPayload) parsePathParams() error {
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

func (applyFlows *ConfigurationPayload) savePathParams(
	fileSysOp *config.FileSystemOperation,
) error {
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

func (applyFlows *ConfigurationPayload) parseGatewayConfig() error {
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

func (applyFlows *ConfigurationPayload) saveGatewayConfig(
	fileSysOp *config.FileSystemOperation,
) error {
	if !applyFlows.isGatewayConfigSpecified() {
		return nil
	}

	return fileSysOp.SaveGatewayConfig(applyFlows.parsedGatewayConfig)
}

func (applyFlows *ConfigurationPayload) parseMetricsConfig() error {
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

func (applyFlows *ConfigurationPayload) saveMetricsConfig(
	fileSysOp *config.FileSystemOperation,
) error {
	if !applyFlows.isMetricsConfigSpecified() {
		return nil
	}

	return fileSysOp.SaveMetricsConfig(applyFlows.parsedMetrics)
}
