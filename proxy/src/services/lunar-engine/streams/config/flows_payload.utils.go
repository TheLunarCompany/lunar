package streamconfig

import (
	"encoding/base64"
	"fmt"
	configstate "lunar/engine/streams/config-state"
	"lunar/engine/utils/environment"
	"os"
	"path/filepath"

	"github.com/rs/zerolog/log"
)

const (
	flowsDirKey          = "flows"
	quotasDirKey         = "quotas"
	pathParamsDirKey     = "path_params"
	gatewayConfigFileKey = "gateway_config.yaml"
	metricsConfigFileKey = "metrics.yaml"
)

func NewConfigurationPayload() *ConfigurationPayload {
	return NewConfigurationPayloadFromPath(environment.GetConfigRootDirectory())
}

func NewConfigurationPayloadFromPath(loadRootPath string) *ConfigurationPayload {
	return &ConfigurationPayload{
		loadRootPath:     loadRootPath,
		Flows:            make(map[string]string),
		Quotas:           make(map[string]string),
		PathParams:       make(map[string]string),
		parsedFlows:      make(map[string][]byte),
		parsedQuotas:     make(map[string][]byte),
		parsedPathParams: make(map[string][]byte),
	}
}

func NewContractPayload() *ContractPayload {
	return &ContractPayload{}
}

func NewContractResponsePayload() *ContractResponsePayload {
	return &ContractResponsePayload{
		OperationResponse: &ContractOperationResponse{},
	}
}

func NewGetOperationResponse() *GetOperationResponse {
	return &GetOperationResponse{ContractResponse: NewResponse()}
}

func NewResponse() *ContractResponse {
	return &ContractResponse{
		Status: "OK",
	}
}

func (c *ContractPayload) IsDataProvided() bool {
	if c.Operation != nil && c.Operation.IsDataProvided() {
		return true
	}
	return false
}

func (c *ContractPayload) ParsePayload() error {
	if !c.IsDataProvided() {
		return nil
	}
	return c.Operation.GetData().ParsePayload()
}

func (c *ContractOperation) GetData() ContractOperationI {
	if c.Get != nil {
		return c.Get
	}
	if c.Init != nil {
		return c.Init
	}
	if c.Update != nil {
		return c.Update
	}
	if c.Delete != nil {
		return c.Delete
	}
	if c.Restore != nil {
		return c.Restore
	}
	return nil
}

func (c *ContractOperation) IsDataProvided() bool {
	if c.Get != nil || c.Init != nil || c.Update != nil || c.Delete != nil || c.Restore != nil {
		return true
	}
	return false
}

func (c *ContractOperation) IsGetOperation() bool {
	return c.Get != nil
}

func (c *ContractOperation) IsRestoreOperation() bool {
	return c.Restore != nil
}

func (c *ContractOperation) Apply() (*ContractResponsePayload, error) {
	data := c.GetData()
	if data == nil {
		return nil, fmt.Errorf("no operation data provided")
	}

	configState := configstate.Get()
	if !c.IsGetOperation() && !c.IsRestoreOperation() {
		if err := configState.Backup(); err != nil {
			log.Error().Err(err).Msg("Failed to backup file system operations")
			return nil, err
		}
	}

	respPayload, err := data.Apply()
	if err != nil {
		log.Error().Err(err).Msg("Failed to apply contract operation")
		if restoreErr := configState.RestoreNewest(); restoreErr != nil {
			log.Error().Err(restoreErr).Msg("Failed to restore file system operations")
			return respPayload, fmt.Errorf(
				"failed to restore file system after error: %s. %s", err.Error(), restoreErr.Error())
		}
		return respPayload, err
	}
	return respPayload, nil
}

func (c *GetOperation) ParsePayload() error {
	return nil
}

func (c *InitOperation) ParsePayload() error {
	return nil
}

func (c *DeleteOperation) ParsePayload() error {
	return nil
}

func (c *RestoreOperation) ParsePayload() error {
	return nil
}

func (c *ConfigurationPayload) ParsePayload() error {
	if err := c.parseFlows(); err != nil {
		return err
	}

	if err := c.parseQuotas(); err != nil {
		return err
	}

	if err := c.parsePathParams(); err != nil {
		return err
	}

	if err := c.parseGatewayConfig(); err != nil {
		return err
	}

	return c.parseMetricsConfig()
}

func (c *ConfigurationPayload) PreparePayload() error {
	if err := c.prepareFlows(); err != nil {
		return err
	}

	if err := c.prepareQuotas(); err != nil {
		return err
	}

	if err := c.preparePathParams(); err != nil {
		return err
	}

	if err := c.prepareGatewayConfig(); err != nil {
		return err
	}

	return c.prepareMetricsConfig()
}

func (c *ConfigurationPayload) SavePayloadContentToDisk() error {
	if err := c.saveFlows(); err != nil {
		return err
	}

	if err := c.saveQuotas(); err != nil {
		return err
	}

	if err := c.savePathParams(); err != nil {
		return err
	}

	if err := c.saveGatewayConfig(); err != nil {
		return err
	}

	return c.saveMetricsConfig()
}

func (c *ConfigurationPayload) LoadPayloadContentFromDisk() error {
	if err := c.loadFlows(); err != nil {
		log.Trace().Err(err).Msg("Failed to load flows")
	}
	if err := c.loadQuotas(); err != nil {
		log.Trace().Err(err).Msg("Failed to load quotas")
	}
	if err := c.loadPathParams(); err != nil {
		log.Trace().Err(err).Msg("Failed to load path params")
	}
	if err := c.loadGatewayConfig(); err != nil {
		log.Trace().Err(err).Msg("Failed to load gateway config")
	}
	if err := c.loadMetricsConfig(); err != nil {
		log.Trace().Err(err).Msg("Failed to load metrics config")
	}
	return nil
}

func (c *ConfigurationPayload) GetFlows() (map[string]string, bool) {
	return c.Flows, c.isFlowSpecified()
}

func (c *ConfigurationPayload) GetQuotas() (map[string]string, bool) {
	return c.Quotas, c.isQuotaSpecified()
}

func (c *ConfigurationPayload) GetPathParams() (map[string]string, bool) {
	return c.PathParams, c.isPathParamsSpecified()
}

func (c *ConfigurationPayload) GetGatewayConfig() (string, bool) {
	return c.GatewayConfig, c.isGatewayConfigSpecified()
}

func (c *ConfigurationPayload) GetMetricsConfig() (string, bool) {
	return c.Metrics, c.isMetricsConfigSpecified()
}

func (c *ConfigurationPayload) isFlowSpecified() bool {
	return c.Flows != nil
}

func (c *ConfigurationPayload) isQuotaSpecified() bool {
	return c.Quotas != nil
}

func (c *ConfigurationPayload) isPathParamsSpecified() bool {
	return c.PathParams != nil
}

func (c *ConfigurationPayload) isGatewayConfigSpecified() bool {
	return c.GatewayConfig != ""
}

func (c *ConfigurationPayload) isMetricsConfigSpecified() bool {
	return c.Metrics != ""
}

func (c *ConfigurationPayload) parseFlows() error {
	if !c.isFlowSpecified() {
		return nil
	}

	if c.parsedFlows == nil {
		c.parsedFlows = make(map[string][]byte)
	}

	for name, content := range c.Flows {
		decodedContent, err := base64.StdEncoding.DecodeString(content)
		if err != nil {
			return err
		}

		c.parsedFlows[name] = decodedContent
	}
	return nil
}

func (c *ConfigurationPayload) saveFlows() error {
	if !c.isFlowSpecified() {
		return nil
	}

	for name, content := range c.parsedFlows {
		if err := configstate.Get().SaveFlowFile(name, content); err != nil {
			return err
		}
	}
	return nil
}

func (c *ConfigurationPayload) prepareFlows() error {
	if c.parsedFlows == nil {
		return nil
	}

	for name, content := range c.parsedFlows {
		encodedContent := base64.StdEncoding.EncodeToString(content)
		c.Flows[name] = encodedContent
	}
	return nil
}

func (c *ConfigurationPayload) loadFlows() error {
	flowsDir := filepath.Join(c.loadRootPath, flowsDirKey)
	return loadFiles(flowsDir, c.parsedFlows, configstate.Get().LoadFlow)
}

func (c *ConfigurationPayload) parseQuotas() error {
	if !c.isQuotaSpecified() {
		return nil
	}

	if c.parsedQuotas == nil {
		c.parsedQuotas = make(map[string][]byte)
	}

	for name, content := range c.Quotas {
		decodedContent, err := base64.StdEncoding.DecodeString(content)
		if err != nil {
			return err
		}

		c.parsedQuotas[name] = decodedContent
	}
	return nil
}

func (c *ConfigurationPayload) saveQuotas() error {
	if !c.isQuotaSpecified() {
		return nil
	}

	for name, content := range c.parsedQuotas {
		if err := configstate.Get().SaveQuotaFile(name, content); err != nil {
			return err
		}
	}
	return nil
}

func (c *ConfigurationPayload) prepareQuotas() error {
	if c.parsedQuotas == nil {
		return nil
	}

	for name, content := range c.parsedQuotas {
		encodedContent := base64.StdEncoding.EncodeToString(content)
		c.Quotas[name] = encodedContent
	}
	return nil
}

func (c *ConfigurationPayload) loadQuotas() error {
	quotasDir := filepath.Join(c.loadRootPath, quotasDirKey)
	return loadFiles(quotasDir, c.parsedQuotas, configstate.Get().LoadQuota)
}

func (c *ConfigurationPayload) parsePathParams() error {
	if !c.isPathParamsSpecified() {
		return nil
	}

	if c.parsedPathParams == nil {
		c.parsedPathParams = make(map[string][]byte)
	}

	for name, content := range c.PathParams {
		decodedContent, err := base64.StdEncoding.DecodeString(content)
		if err != nil {
			return err
		}

		c.parsedPathParams[name] = decodedContent
	}
	return nil
}

func (c *ConfigurationPayload) savePathParams() error {
	if !c.isPathParamsSpecified() {
		return nil
	}

	for name, content := range c.parsedPathParams {
		if err := configstate.Get().SavePathParamsFile(name, content); err != nil {
			return err
		}
	}
	return nil
}

func (c *ConfigurationPayload) preparePathParams() error {
	if c.parsedPathParams == nil {
		return nil
	}
	for name, content := range c.parsedPathParams {
		encodedContent := base64.StdEncoding.EncodeToString(content)
		c.PathParams[name] = encodedContent
	}
	return nil
}

func (c *ConfigurationPayload) loadPathParams() error {
	pathParamsDir := filepath.Join(c.loadRootPath, pathParamsDirKey)
	return loadFiles(pathParamsDir, c.parsedPathParams, configstate.Get().LoadPathParams)
}

func (c *ConfigurationPayload) parseGatewayConfig() error {
	if !c.isGatewayConfigSpecified() {
		return nil
	}

	decodedContent, err := base64.StdEncoding.DecodeString(c.GatewayConfig)
	if err != nil {
		return err
	}

	c.parsedGatewayConfig = decodedContent
	return nil
}

func (c *ConfigurationPayload) saveGatewayConfig() error {
	if !c.isGatewayConfigSpecified() {
		return nil
	}

	return configstate.Get().SaveGatewayConfigFile(c.parsedGatewayConfig)
}

func (c *ConfigurationPayload) prepareGatewayConfig() error {
	if c.parsedGatewayConfig == nil {
		return nil
	}

	encodedContent := base64.StdEncoding.EncodeToString(c.parsedGatewayConfig)
	c.GatewayConfig = encodedContent
	return nil
}

func (c *ConfigurationPayload) loadGatewayConfig() error {
	gatewayConfigPath := filepath.Join(c.loadRootPath, gatewayConfigFileKey)
	content, err := configstate.Get().LoadGatewayConfig(gatewayConfigPath)
	if err != nil {
		return err
	}
	c.parsedGatewayConfig = content
	return nil
}

func (c *ConfigurationPayload) parseMetricsConfig() error {
	if !c.isMetricsConfigSpecified() {
		return nil
	}

	decodedContent, err := base64.StdEncoding.DecodeString(c.Metrics)
	if err != nil {
		return err
	}

	c.parsedMetrics = decodedContent
	return nil
}

func (c *ConfigurationPayload) saveMetricsConfig() error {
	if !c.isMetricsConfigSpecified() {
		return nil
	}

	return configstate.Get().SaveMetricsConfigFile(c.parsedMetrics)
}

func (c *ConfigurationPayload) prepareMetricsConfig() error {
	if c.parsedMetrics == nil {
		return nil
	}

	encodedContent := base64.StdEncoding.EncodeToString(c.parsedMetrics)
	c.Metrics = encodedContent
	return nil
}

func (c *ConfigurationPayload) loadMetricsConfig() error {
	metricsConfigPath := filepath.Join(c.loadRootPath, metricsConfigFileKey)
	data, err := configstate.Get().LoadMetricsConfig(metricsConfigPath)
	if err != nil {
		return err
	}
	c.parsedMetrics = data
	return nil
}

func loadFiles(dir string,
	target map[string][]byte,
	fileLoadFunc func(string) ([]byte, error),
) error {
	return filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}

		fileName := filepath.Base(path)
		content, err := fileLoadFunc(fileName)
		if err != nil {
			return err
		}

		target[fileName] = content
		return nil
	})
}
