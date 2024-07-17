package resources

import (
	"fmt"
	"io/fs"
	internaltypes "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"
	quotaresource "lunar/engine/streams/resources/quota"
	resourceutils "lunar/engine/streams/resources/utils"
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/configuration"
	"os"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog/log"
)

type ResourceManagement struct {
	// quotas   *Resource[publictypes.QuotaResourceI]
	quotas   *Resource[*quotaresource.QuotaResource]
	flowData map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation
}

func NewResourceManagement() (*ResourceManagement, error) {
	management := &ResourceManagement{
		// quotas:   NewResource[publictypes.QuotaResourceI](),
		quotas:   NewResource[*quotaresource.QuotaResource](),
		flowData: make(map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation),
	}
	if err := management.init(); err != nil {
		return nil, err
	}
	return management, nil
}

func (rm *ResourceManagement) GetQuota(ID string) (publictypes.QuotaResourceI, error) {
	quotaResource, found := rm.quotas.Get(ID)
	if !found {
		return nil, fmt.Errorf("quota resource with ID %s not found", ID)
	}
	return quotaResource, nil
}

func (rm *ResourceManagement) UpdateQuota(ID string, metaData publictypes.QuotaMetaDataI) error {
	quotaResource, found := rm.quotas.Get(ID)
	if !found {
		log.Trace().Msgf("Could not locate quota resource with ID %s", ID)
		return nil
	}

	return quotaResource.Update(metaData)
}

func (rm *ResourceManagement) GetFlowData(
	filter publictypes.ComparableFilter,
) (*resourceutils.SystemFlowRepresentation, error) {
	log.Trace().Msgf("Looking for system flow with Key: %v", filter)
	flowRepresentation, found := rm.flowData[filter]
	if !found {
		return nil, fmt.Errorf("system flow data with filter %v not found", filter)
	}
	return flowRepresentation, nil
}

func (rm *ResourceManagement) GetUnReferencedFlowData() []*resourceutils.SystemFlowRepresentation {
	log.Trace().Msg("Retrieving unreferenced system flow data")
	var flowRepresentation []*resourceutils.SystemFlowRepresentation
	for _, systemFlow := range rm.flowData {
		if systemFlow.IsReferencedByUsedFlow() {
			continue
		}
		flowRepresentation = append(flowRepresentation, systemFlow)
	}

	return flowRepresentation
}

func (
	rm *ResourceManagement,
) GetFlowsData() map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation {
	return rm.flowData
}

func (rm *ResourceManagement) init() error {
	quotaData, err := loadAndParseQuotaFiles()
	if err != nil {
		return err
	}

	return rm.loadQuotaResources(quotaData)
}

func loadAndParseQuotaFiles() ([]*quotaresource.QuotaRepresentation, error) {
	resources := environment.GetResourcesDirectory()
	quotaResourceFiles, err := findQuotaResources(resources)
	var quotaData []*quotaresource.QuotaRepresentation
	if err != nil {
		return nil, err
	}
	for _, path := range quotaResourceFiles {
		config, readErr := configuration.DecodeYAML[quotaresource.QuotaResourceData](path)
		if readErr != nil {
			return nil, readErr
		}
		quotaData = append(quotaData, config.Quotas...)
	}
	return quotaData, nil
}

func (rm *ResourceManagement) loadQuotaResources(
	quotaData []*quotaresource.QuotaRepresentation,
) error {
	quotasMetaData := rm.generateQuotaMetaData(quotaData)
	for _, metaData := range quotasMetaData {
		quotaResource := quotaresource.NewQuota(metaData)

		log.Trace().Msgf("Adding quota resource with: ID %s, Filter: %v",
			metaData.GetID(),
			metaData.GetFilter(),
		)

		flowData, found := rm.flowData[metaData.Filter.ToComparable()]
		if !found {
			flowData = resourceutils.NewSystemFlowRepresentation()
			rm.flowData[metaData.Filter.ToComparable()] = flowData
		}
		err := flowData.AddSystemFlow(quotaResource.GetSystemFlow())
		if err != nil {
			return err
		}

		rm.quotas.Set(metaData.GetID(), quotaResource)
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
	quotaData []*quotaresource.QuotaRepresentation,
) []*quotaresource.QuotaMetaData {
	var metaData []*quotaresource.QuotaMetaData
	for _, data := range quotaData {
		metaData = append(metaData, &quotaresource.QuotaMetaData{
			ID:       data.ID,
			Filter:   data.Filter,
			Strategy: data.Strategy,
		})
	}
	return metaData
}
