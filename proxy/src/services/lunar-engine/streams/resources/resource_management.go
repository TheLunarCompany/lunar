package resources

import (
	"fmt"
	"io/fs"
	internaltypes "lunar/engine/streams/internal-types"
	quotaresource "lunar/engine/streams/resources/quota"
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/configuration"
	"os"
	"path/filepath"
	"strings"
)

type ResourceManagement struct {
	quotas *Resource[*quotaresource.QuotaResource]
}

func NewResourceManagement() (*ResourceManagement, error) {
	management := &ResourceManagement{
		quotas: NewResource[*quotaresource.QuotaResource](),
	}
	if err := management.init(); err != nil {
		return nil, err
	}
	return management, nil
}

func (rm *ResourceManagement) GetQuota(ID string) (*quotaresource.QuotaResource, error) {
	quotaResource, found := rm.quotas.Get(ID)
	if !found {
		return nil, fmt.Errorf("quota resource with ID %s not found", ID)
	}
	return quotaResource, nil
}

func (rm *ResourceManagement) UpdateQuota(ID string, metaData *quotaresource.QuotaMetaData) error {
	quotaResource, err := rm.GetQuota(ID)
	if err != nil {
		return err
	}
	return quotaResource.Update(metaData)
}

func (rm *ResourceManagement) init() error {
	return rm.loadQuotaResources()
}

func (rm *ResourceManagement) loadQuotaResources() error {
	resources := environment.GetResourcesDirectory()
	quotaResourceFiles, err := findQuotaResources(resources)
	var quotaData []quotaresource.QuotaRepresentation
	if err != nil {
		return err
	}
	for _, path := range quotaResourceFiles {
		config, readErr := configuration.DecodeYAML[quotaresource.QuotaResourceData](path)
		if readErr != nil {
			return readErr
		}
		quotaData = append(quotaData, config.Quotas...)
	}
	quotasMetaData := rm.generateQuotaMetaData(quotaData)
	for _, metaData := range quotasMetaData {
		fmt.Printf("Loading quota resource %s\n", metaData.ID)
		fmt.Printf("Filter: %v\n", metaData.Filter)
		fmt.Printf("Strategy: %v\n", metaData.Strategy.FixedWindow)

		rm.quotas.Set(metaData.ID, quotaresource.NewQuota(metaData))
	}

	return nil
}

func findQuotaResources(dir string) ([]string, error) {
	var files []string
	err := filepath.WalkDir(dir, func(path string, directory fs.DirEntry, err error) error {
		if err != nil {
			if os.IsNotExist(err) { // ignore if directory does not exist
				return nil
			}
			return err
		}

		if !directory.IsDir() && strings.HasSuffix(path, internaltypes.QuotaResourceExtension) {
			files = append(files, path)
		}
		return nil
	})
	return files, err
}

func (rm *ResourceManagement) generateQuotaMetaData(
	quotaData []quotaresource.QuotaRepresentation,
) []*quotaresource.QuotaMetaData {
	var metaData []*quotaresource.QuotaMetaData
	for _, data := range quotaData {
		metaData = append(metaData, &quotaresource.QuotaMetaData{
			ID:       data.ID,
			Filter:   &data.Filter,
			Strategy: &data.Strategy,
		})
	}
	return metaData
}
