package config

import (
	"crypto/md5"
	"encoding/hex"
	"io"
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

type FileSystemBackUp struct {
	data    map[string][]byte
	dataMD5 map[string]string
}

func newFileSystemBackUp() *FileSystemBackUp {
	return &FileSystemBackUp{
		data:    make(map[string][]byte),
		dataMD5: make(map[string]string),
	}
}

func (fsb *FileSystemBackUp) GetDiff(dataMD5 map[string]string) map[string][]byte {
	diff := make(map[string][]byte)
	for key, value := range fsb.dataMD5 {
		if dataMD5[key] != value {
			diff[key] = fsb.data[key]
		}
	}
	return diff
}

func (fsb *FileSystemBackUp) SetMD5OfStorage() {
	for key, value := range fsb.data {
		hash := md5.Sum(value)
		fsb.dataMD5[key] = hex.EncodeToString(hash[:])
	}
}

type FileSystemOperation struct {
	directories map[string]string
	files       map[string]string
	backUp      *FileSystemBackUp
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
		backUp: &FileSystemBackUp{
			data:    make(map[string][]byte),
			dataMD5: make(map[string]string),
		},
	}
}

func (fs *FileSystemOperation) Backup() error {
	fileSystemSnapshot, err := fs.createFileSystemBackUp()
	if err != nil {
		return err
	}

	fs.backUp = fileSystemSnapshot

	return nil
}

func (fs *FileSystemOperation) Restore() error {
	fileSystemSnapshot, err := fs.createFileSystemBackUp()
	if err != nil {
		return err
	}

	// We iterate over the diff and restore the files that have changed.
	for path, content := range fileSystemSnapshot.GetDiff(fs.backUp.dataMD5) {
		if err := fs.storeFileOnDisk(path, content); err != nil {
			return err
		}
	}

	return nil
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

func (fs *FileSystemOperation) CleanFlow(file string) error {
	filePath := filepath.Join(fs.directories[flowsDirKey], file)
	return fs.cleanUpFile(filePath)
}

func (fs *FileSystemOperation) CleanFlowsDirectory() error {
	return fs.cleanUpDirectory(fs.directories[flowsDirKey])
}

func (fs *FileSystemOperation) CleanQuota(file string) error {
	filePath := filepath.Join(fs.directories[quotasDirKey], file)
	return fs.cleanUpFile(filePath)
}

func (fs *FileSystemOperation) CleanQuotasDirectory() error {
	return fs.cleanUpDirectory(fs.directories[quotasDirKey])
}

func (fs *FileSystemOperation) CleanPathParams(file string) error {
	filePath := filepath.Join(fs.directories[pathParamsDirKey], file)
	return fs.cleanUpFile(filePath)
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

func (fs *FileSystemOperation) LoadFlow(fileName string) ([]byte, error) {
	filePath := filepath.Join(environment.GetStreamsFlowsDirectory(), fileName)
	return fs.readFileFromDisk(filePath)
}

func (fs *FileSystemOperation) SaveQuota(fileName string, content []byte) error {
	filePath := filepath.Join(environment.GetQuotasDirectory(), fileName)
	return fs.storeFileOnDisk(filePath, content)
}

func (fs *FileSystemOperation) LoadQuota(fileName string) ([]byte, error) {
	filePath := filepath.Join(environment.GetQuotasDirectory(), fileName)
	return fs.readFileFromDisk(filePath)
}

func (fs *FileSystemOperation) SavePathParams(fileName string, content []byte) error {
	filePath := filepath.Join(environment.GetPathParamsDirectory(), fileName)
	return fs.storeFileOnDisk(filePath, content)
}

func (fs *FileSystemOperation) LoadPathParams(fileName string) ([]byte, error) {
	filePath := filepath.Join(environment.GetPathParamsDirectory(), fileName)
	return fs.readFileFromDisk(filePath)
}

func (fs *FileSystemOperation) SaveGatewayConfig(content []byte) error {
	return fs.storeFileOnDisk(environment.GetGatewayConfigPath(), content)
}

func (fs *FileSystemOperation) LoadGatewayConfig() ([]byte, error) {
	filePath := environment.GetGatewayConfigPath()
	return fs.readFileFromDisk(filePath)
}

func (fs *FileSystemOperation) SaveMetricsConfig(content []byte) error {
	return fs.storeFileOnDisk(environment.GetMetricsConfigFilePath(), content)
}

func (fs *FileSystemOperation) LoadMetricsConfig() ([]byte, error) {
	filePath := environment.GetMetricsConfigFilePath()
	return fs.readFileFromDisk(filePath)
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
	_ = fs.cleanUpFile(filePath)

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

func (fs *FileSystemOperation) readFileFromDisk(filePath string) ([]byte, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}
	return content, nil
}

func (fs *FileSystemOperation) createFileSystemBackUp() (*FileSystemBackUp, error) {
	tempBackUp := newFileSystemBackUp()

	for _, dir := range fs.directories {
		if err := fs.backupDirectory(dir, tempBackUp); err != nil {
			return tempBackUp, err
		}
	}

	for _, file := range fs.files {
		if err := fs.backupFile(file, tempBackUp); err != nil {
			return tempBackUp, err
		}
	}

	tempBackUp.SetMD5OfStorage()

	return tempBackUp, nil
}

func (fs *FileSystemOperation) backupFile(filePath string, backup *FileSystemBackUp) error {
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return nil
	}

	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		return err
	}
	backup.data[filePath] = content

	return nil
}

func (fs *FileSystemOperation) backupDirectory(
	dirPath string,
	backup *FileSystemBackUp,
) error {
	// Check if the directory exists before walking it
	if _, err := os.Stat(dirPath); os.IsNotExist(err) {
		return nil // Skip this directory
	} else if err != nil {
		return err
	}

	return filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			if err := fs.backupFile(path, backup); err != nil {
				return err
			}
		}
		return nil
	})
}
