package streamconfig

import (
	"encoding/base64"
	"fmt"
	"lunar/engine/config"
	"lunar/engine/utils/environment"
	"os"
	"path/filepath"

	"github.com/rs/zerolog/log"
)

func NewConfigurationPayload() *ConfigurationPayload {
	return &ConfigurationPayload{
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
	return nil
}

func (c *ContractOperation) IsDataProvided() bool {
	if c.Get != nil || c.Init != nil || c.Update != nil || c.Delete != nil {
		return true
	}
	return false
}

func (c *ContractOperation) IsGetOperation() bool {
	return c.Get != nil
}

func (c *ContractOperation) Apply(
	fileSysOp *config.FileSystemOperation,
) (*ContractResponsePayload, error) {
	data := c.GetData()
	if data == nil {
		return nil, fmt.Errorf("no operation data provided")
	}

	if err := fileSysOp.Backup(); err != nil {
		log.Error().Err(err).Msg("Failed to backup file system operations")
		return nil, err
	}

	respPayload, err := data.Apply(fileSysOp)
	if err != nil {
		log.Error().Err(err).Msg("Failed to apply contract operation")
		if restoreErr := fileSysOp.Restore(); restoreErr != nil {
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

func (c *ConfigurationPayload) CleanUpGatewayDirectories(
	fileSysOp *config.FileSystemOperation,
) error {
	return fileSysOp.CleanAll()
}

func (c *ConfigurationPayload) MakeCleanUpsByContent(fileSysOp *config.FileSystemOperation) error {
	if c.isFlowSpecified() {
		if err := fileSysOp.CleanFlowsDirectory(); err != nil {
			return err
		}
	}

	if c.isQuotaSpecified() {
		if err := fileSysOp.CleanQuotasDirectory(); err != nil {
			return err
		}
	}

	if c.isPathParamsSpecified() {
		if err := fileSysOp.CleanPathParamsDirectory(); err != nil {
			return err
		}
	}

	if c.isGatewayConfigSpecified() {
		if err := fileSysOp.CleanGatewayConfigFile(); err != nil {
			return err
		}
	}

	if c.isMetricsConfigSpecified() {
		if err := fileSysOp.CleanMetricsConfigFile(); err != nil {
			return err
		}
	}
	return nil
}

func (c *ConfigurationPayload) SavePayloadContentToDisk(
	fileSysOp *config.FileSystemOperation,
) error {
	if err := c.saveFlows(fileSysOp); err != nil {
		return err
	}

	if err := c.saveQuotas(fileSysOp); err != nil {
		return err
	}

	if err := c.savePathParams(fileSysOp); err != nil {
		return err
	}

	if err := c.saveGatewayConfig(fileSysOp); err != nil {
		return err
	}

	return c.saveMetricsConfig(fileSysOp)
}

func (c *ConfigurationPayload) LoadPayloadContentFromDisk(
	fileSysOp *config.FileSystemOperation,
) error {
	if err := c.loadFlows(fileSysOp); err != nil {
		log.Trace().Err(err).Msg("Failed to load flows")
	}
	if err := c.loadQuotas(fileSysOp); err != nil {
		log.Trace().Err(err).Msg("Failed to load quotas")
	}
	if err := c.loadPathParams(fileSysOp); err != nil {
		log.Trace().Err(err).Msg("Failed to load path params")
	}
	if err := c.loadGatewayConfig(fileSysOp); err != nil {
		log.Trace().Err(err).Msg("Failed to load gateway config")
	}
	if err := c.loadMetricsConfig(fileSysOp); err != nil {
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

func (c *ConfigurationPayload) saveFlows(fileSysOp *config.FileSystemOperation) error {
	if !c.isFlowSpecified() {
		return nil
	}

	for name, content := range c.parsedFlows {
		if err := fileSysOp.SaveFlow(name, content); err != nil {
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

func (c *ConfigurationPayload) loadFlows(fileSysOp *config.FileSystemOperation) error {
	flowsDir := environment.GetStreamsFlowsDirectory()
	return loadFiles(flowsDir, c.parsedFlows, fileSysOp.LoadFlow)
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

func (c *ConfigurationPayload) saveQuotas(fileSysOp *config.FileSystemOperation) error {
	if !c.isQuotaSpecified() {
		return nil
	}

	for name, content := range c.parsedQuotas {
		if err := fileSysOp.SaveQuota(name, content); err != nil {
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

func (c *ConfigurationPayload) loadQuotas(fileSysOp *config.FileSystemOperation) error {
	quotasDir := environment.GetQuotasDirectory()
	return loadFiles(quotasDir, c.parsedQuotas, fileSysOp.LoadQuota)
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

func (c *ConfigurationPayload) savePathParams(
	fileSysOp *config.FileSystemOperation,
) error {
	if !c.isPathParamsSpecified() {
		return nil
	}

	for name, content := range c.parsedPathParams {
		if err := fileSysOp.SavePathParams(name, content); err != nil {
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

func (c *ConfigurationPayload) loadPathParams(fileSysOp *config.FileSystemOperation) error {
	pathParamsDir := environment.GetPathParamsDirectory()
	return loadFiles(pathParamsDir, c.parsedPathParams, fileSysOp.LoadPathParams)
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

func (c *ConfigurationPayload) saveGatewayConfig(
	fileSysOp *config.FileSystemOperation,
) error {
	if !c.isGatewayConfigSpecified() {
		return nil
	}

	return fileSysOp.SaveGatewayConfig(c.parsedGatewayConfig)
}

func (c *ConfigurationPayload) prepareGatewayConfig() error {
	if c.parsedGatewayConfig == nil {
		return nil
	}

	encodedContent := base64.StdEncoding.EncodeToString(c.parsedGatewayConfig)
	c.GatewayConfig = encodedContent
	return nil
}

func (c *ConfigurationPayload) loadGatewayConfig(fileSysOp *config.FileSystemOperation) error {
	content, err := fileSysOp.LoadGatewayConfig()
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

func (c *ConfigurationPayload) saveMetricsConfig(fileSysOp *config.FileSystemOperation) error {
	if !c.isMetricsConfigSpecified() {
		return nil
	}

	return fileSysOp.SaveMetricsConfig(c.parsedMetrics)
}

func (c *ConfigurationPayload) prepareMetricsConfig() error {
	if c.parsedMetrics == nil {
		return nil
	}

	encodedContent := base64.StdEncoding.EncodeToString(c.parsedMetrics)
	c.Metrics = encodedContent
	return nil
}

func (c *ConfigurationPayload) loadMetricsConfig(fileSysOp *config.FileSystemOperation) error {
	data, err := fileSysOp.LoadMetricsConfig()
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
