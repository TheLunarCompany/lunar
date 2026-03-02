package configstate

import (
	internaltypes "lunar/engine/streams/internal-types"
	"lunar/engine/utils/environment"
	"path/filepath"
	"strings"
	"sync"
)

var (
	instance *ConfigState
	once     sync.Once
)

// ConfigState is a singleton struct that holds the configuration state.
func Get() *ConfigState {
	once.Do(func() {
		instance = &ConfigState{flows: make(map[string]internaltypes.FlowI)}
	})
	return instance
}

// StartTransaction starts a transaction by locking the mutex.
// It returns a function that unlocks the mutex when called.
// This is useful for ensuring that the configuration state is not modified
// while a transaction is in progress.
// The caller must ensure that the returned function is called to unlock the mutex.
func (c *ConfigState) StartTransaction() func() {
	c.txnMu.Lock()
	return func() {
		c.txnMu.Unlock()
	}
}

func (c *ConfigState) AddFlow(flow internaltypes.FlowI) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.flows[flow.GetName()] = flow
}

func (c *ConfigState) GetFlow(name string) (internaltypes.FlowI, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	flow, exists := c.flows[name]
	return flow, exists
}

// Backup creates a backup of the current configuration state.
func (c *ConfigState) Backup() error {
	return backupConfig()
}

func (c *ConfigState) ListBackups() ([]string, error) {
	return listBackupFolders(environment.GetConfigBackupDirectory())
}

// RestoreCheckpoint restores the configuration state from a specific checkpoint.
func (c *ConfigState) RestoreCheckpoint(checkpoint string) error {
	if checkpoint == "" {
		return c.RestoreNewest()
	}

	timestamp, _ := strings.CutPrefix(checkpoint, configBackupPrefix)
	return restoreConfigFromTimestamp(timestamp)
}

// Restore restores the configuration state from a backup.
func (c *ConfigState) RestoreNewest() error {
	return restoreConfigNewest()
}

// RestoreFromTimestamp restores the configuration state from a backup with the given timestamp.
func (c *ConfigState) RestoreFromTimestamp(timestamp string) error {
	return restoreConfigFromTimestamp(timestamp)
}

// RestoreFromBackupFolder restores the configuration state from a specific backup folder.
func (c *ConfigState) RestoreFromBackupFolder(backupFolder string) error {
	return restoreConfigFromBackupFolder(backupFolder)
}

// Clean removes all files and folders inside the config root directory.
func (c *ConfigState) Clean() error {
	return cleanAll()
}

// SaveFlowFile saves the given content to a file in the flows directory.
func (c *ConfigState) SaveFlowFile(fileName string, content []byte) error {
	filePath := filepath.Join(environment.GetStreamsFlowsDirectory(), fileName)
	return storeFileOnDisk(filePath, content)
}

// LoadFlow loads the content of a file from the flows directory.
func (c *ConfigState) LoadFlow(fileName string) ([]byte, error) {
	filePath := filepath.Join(environment.GetStreamsFlowsDirectory(), fileName)
	return readFileFromDisk(filePath)
}

// SaveQuotaFile saves the given content to a file in the quotas directory.
func (c *ConfigState) SaveQuotaFile(fileName string, content []byte) error {
	filePath := filepath.Join(environment.GetQuotasDirectory(), fileName)
	return storeFileOnDisk(filePath, content)
}

// LoadQuota loads the content of a file from the quotas directory.
func (c *ConfigState) LoadQuota(fileName string) ([]byte, error) {
	filePath := filepath.Join(environment.GetQuotasDirectory(), fileName)
	return readFileFromDisk(filePath)
}

// SavePathParamsFile saves the given content to a file in the path parameters directory.
func (c *ConfigState) SavePathParamsFile(fileName string, content []byte) error {
	filePath := filepath.Join(environment.GetPathParamsDirectory(), fileName)
	return storeFileOnDisk(filePath, content)
}

// LoadPathParams loads the content of a file from the path parameters directory.
func (c *ConfigState) LoadPathParams(fileName string) ([]byte, error) {
	filePath := filepath.Join(environment.GetPathParamsDirectory(), fileName)
	return readFileFromDisk(filePath)
}

// SaveGatewayConfigFile saves the given content to the gateway config file.
func (c *ConfigState) SaveGatewayConfigFile(content []byte) error {
	return storeFileOnDisk(environment.GetGatewayConfigPath(), content)
}

// LoadGatewayConfig loads the content of the gateway config file.
func (c *ConfigState) LoadGatewayConfig(filePath string) ([]byte, error) {
	return readFileFromDisk(filePath)
}

// SaveMetricsConfigFile saves the given content to the metrics config file.
func (c *ConfigState) SaveMetricsConfigFile(content []byte) error {
	return storeFileOnDisk(environment.GetMetricsConfigFilePath(), content)
}

// LoadMetricsConfig loads the content of the metrics config file.
func (c *ConfigState) LoadMetricsConfig(filePath string) ([]byte, error) {
	return readFileFromDisk(filePath)
}

// RestoreGatewayConfig restores the gateway config file from the default path.
func (c *ConfigState) RestoreMetricsConfig() error {
	metricsContent, err := readFileFromDisk(environment.GetMetricsConfigFilePathOrDefault())
	if err != nil {
		return err
	}
	return storeFileOnDisk(environment.GetMetricsConfigFilePath(), metricsContent)
}

func (c *ConfigState) CleanFlow(file string) error {
	filePath := filepath.Join(environment.GetStreamsFlowsDirectory(), file)
	return cleanUpFile(filePath)
}

func (c *ConfigState) CleanFlowsDirectory() error {
	return cleanUpDirectory(environment.GetStreamsFlowsDirectory())
}

func (c *ConfigState) CleanQuota(file string) error {
	filePath := filepath.Join(environment.GetQuotasDirectory(), file)
	return cleanUpFile(filePath)
}

func (c *ConfigState) CleanQuotasDirectory() error {
	return cleanUpDirectory(environment.GetQuotasDirectory())
}

func (c *ConfigState) CleanPathParams(file string) error {
	filePath := filepath.Join(environment.GetPathParamsDirectory(), file)
	return cleanUpFile(filePath)
}

func (c *ConfigState) CleanPathParamsDirectory() error {
	return cleanUpDirectory(environment.GetPathParamsDirectory())
}

func (c *ConfigState) CleanGatewayConfigFile() error {
	return cleanUpFile(environment.GetGatewayConfigPath())
}

func (c *ConfigState) CleanMetricsConfigFile() error {
	return cleanUpFile(environment.GetUserMetricsConfigFilePath())
}
