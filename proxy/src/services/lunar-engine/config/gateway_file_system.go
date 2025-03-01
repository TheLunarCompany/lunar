package config

import (
	"lunar/engine/utils/environment"
	"os"
	"path/filepath"
)

const (
	flowsDirKey          = "flows"
	quotasDirKey         = "quotas"
	pathParamsDirKey     = "pathParams"
	gatewayConfigFileKey = "gatewayConfig"
	metricsConfigFileKey = "metricsConfig"
)

type FileSystemOperation struct {
	directories map[string]string
	files       map[string]string
}

func NewFileSystemOperation() *FileSystemOperation {
	return &FileSystemOperation{
		directories: map[string]string{
			flowsDirKey:      environment.GetStreamsFlowsDirectory(),
			quotasDirKey:     environment.GetQuotasDirectory(),
			pathParamsDirKey: environment.GetPathParamsDirectory(),
		},
		files: map[string]string{
			gatewayConfigFileKey: environment.GetGatewayConfigPath(),
			metricsConfigFileKey: environment.GetUserMetricsConfigFilePath(),
		},
	}
}

func (fs *FileSystemOperation) CleanAll() error {
	for _, dir := range fs.directories {
		if err := fs.cleanUpDirectory(dir); err != nil {
			return err
		}
	}

	for _, file := range fs.files {
		if err := fs.cleanUpFile(file); err != nil {
			return err
		}
	}

	return nil
}

func (fs *FileSystemOperation) CleanFlowsDirectory() error {
	return fs.cleanUpDirectory(fs.directories[flowsDirKey])
}

func (fs *FileSystemOperation) CleanQuotasDirectory() error {
	return fs.cleanUpDirectory(fs.directories[quotasDirKey])
}

func (fs *FileSystemOperation) CleanPathParamsDirectory() error {
	return fs.cleanUpDirectory(fs.directories[pathParamsDirKey])
}

func (fs *FileSystemOperation) CleanGatewayConfigFile() error {
	return fs.cleanUpFile(fs.files[gatewayConfigFileKey])
}

func (fs *FileSystemOperation) CleanMetricsConfigFile() error {
	return fs.cleanUpFile(fs.files[metricsConfigFileKey])
}

func (fs *FileSystemOperation) SaveFlow(fileName string, content []byte) error {
	filePath := filepath.Join(environment.GetStreamsFlowsDirectory(), fileName)
	return fs.storeFileOnDisk(filePath, content)
}

func (fs *FileSystemOperation) SaveQuota(fileName string, content []byte) error {
	filePath := filepath.Join(environment.GetQuotasDirectory(), fileName)
	return fs.storeFileOnDisk(filePath, content)
}

func (fs *FileSystemOperation) SavePathParams(fileName string, content []byte) error {
	filePath := filepath.Join(environment.GetPathParamsDirectory(), fileName)
	return fs.storeFileOnDisk(filePath, content)
}

func (fs *FileSystemOperation) SaveGatewayConfig(content []byte) error {
	return fs.storeFileOnDisk(environment.GetGatewayConfigPath(), content)
}

func (fs *FileSystemOperation) SaveMetricsConfig(content []byte) error {
	return fs.storeFileOnDisk(environment.GetMetricsConfigFilePath(), content)
}

func (fs *FileSystemOperation) cleanUpFile(filePath string) error {
	if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (fs *FileSystemOperation) cleanUpDirectory(cleanupPath string) error {
	err := filepath.Walk(cleanupPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			return os.Remove(path)
		}
		return nil
	})
	return err
}

func (fs *FileSystemOperation) storeFileOnDisk(filePath string, content []byte) error {
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		return err
	}

	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = file.Write(content)
	return err
}
