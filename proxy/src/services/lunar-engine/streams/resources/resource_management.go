package resources

import (
	"errors"
	"fmt"
	"io/fs"
	internaltypes "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"
	quotaresource "lunar/engine/streams/resources/quota"
	resourceutils "lunar/engine/streams/resources/utils"
	streamtypes "lunar/engine/streams/types"
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/configuration"
	"lunar/toolkit-core/network"
	"os"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog/log"
)

type ResourceManagement struct {
	quotas       *Resource[quotaresource.QuotaAdmI]
	reqIDToQuota publictypes.ContextI
	flowData     map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation
	loadedConfig []network.ConfigurationPayload
}

func NewResourceManagement() (*ResourceManagement, error) {
	management := &ResourceManagement{
		loadedConfig: []network.ConfigurationPayload{},
		quotas:       NewResource[quotaresource.QuotaAdmI](),
		reqIDToQuota: streamtypes.NewContext(),
		flowData:     make(map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation),
	}

	if err := management.init(); err != nil {
		return nil, err
	}
	return management, nil
}

func (rm *ResourceManagement) WithQuotaData(
	quotaData []*quotaresource.QuotaResourceData,
) (*ResourceManagement, error) {
	if err := rm.loadQuotaResources(quotaData); err != nil {
		return nil, err
	}
	return rm, nil
}

func (rm *ResourceManagement) OnRequestDrop(APIStream publictypes.APIStreamI) {
	outVal, err := rm.reqIDToQuota.Pop(APIStream.GetID())
	if err != nil {
		log.Debug().Msgf("Could not locate quota resource with ID %s", APIStream.GetID())
		return
	}
	quotaObj, ok := outVal.(publictypes.QuotaResourceI)
	if !ok {
		log.Debug().Msgf("Could not convert quota resource with ID %s", APIStream.GetID())
		return
	}

	if err := (quotaObj).Dec(APIStream); err != nil {
		log.Warn().Err(err).Msgf("Failed to decrement quota for request %s", APIStream.GetID())
	}
}

func (rm *ResourceManagement) OnRequestFinish(APIStream publictypes.APIStreamI) {
	_, _ = rm.reqIDToQuota.Pop(APIStream.GetID())
}

func (rm *ResourceManagement) GetQuota(
	quotaID string,
	reqID string,
) (publictypes.QuotaResourceI, error) {
	quotaResource, found := rm.quotas.Get(quotaID)
	if !found {
		return nil, fmt.Errorf("quota resource with ID %s not found", quotaID)
	}
	quotaObj, err := quotaResource.GetQuota(quotaID)
	if err != nil {
		return nil, err
	}

	if reqID != "" {
		if !rm.reqIDToQuota.Exists(reqID) {
			if err := rm.reqIDToQuota.Set(reqID, quotaObj); err != nil {
				log.Debug().Err(err).
					Msgf("Failed to set quota resource with ID %s for request %s", quotaID, reqID)
			}
		}
	}

	return quotaObj, nil
}

func (rm *ResourceManagement) UpdateQuota(
	quotaID string,
	metaData *quotaresource.QuotaResourceData,
) error {
	// TODO: When updating quota, we should also update the system flow data
	// 			 and update LunarHub with the new configuration
	quotaResource, found := rm.quotas.Get(quotaID)
	if !found {
		log.Trace().Msgf("Could not locate quota resource with ID %s", quotaID)
		return nil
	}

	return quotaResource.Update(metaData)
}

func (rm *ResourceManagement) GetFlowData(
	filter publictypes.ComparableFilter,
) (*resourceutils.SystemFlowRepresentation, error) {
	log.Trace().Msgf("Looking for system flow with Key: %v", filter)
	for key := range rm.flowData {
		log.Trace().Msgf("Key: %v", key)
	}
	flowRepresentation, found := rm.flowData[filter]
	if !found {
		return nil, fmt.Errorf("system flow data with filter %v not found", filter)
	}
	return flowRepresentation, nil
}

func (rm *ResourceManagement) GetLoadedConfig() []network.ConfigurationPayload {
	return rm.loadedConfig
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
	var err error
	var quotaData []*quotaresource.QuotaResourceData

	quotaData, err = rm.loadAndParseQuotaFiles()
	if err != nil {
		return err
	}
	for _, data := range quotaData {
		err = data.Validate()
		if err != nil {
			err = errors.Join(err)
		}
	}
	if err != nil {
		return err
	}
	return rm.loadQuotaResources(quotaData)
}

func (rm *ResourceManagement) loadAndParseQuotaFiles() (
	[]*quotaresource.QuotaResourceData,
	error,
) {
	resources := environment.GetResourcesDirectory()
	quotaResourceFiles, err := findQuotaResources(resources)
	var quotaData []*quotaresource.QuotaResourceData
	if err != nil {
		return nil, err
	}
	for _, path := range quotaResourceFiles {
		config, readErr := configuration.DecodeYAML[quotaresource.QuotaResourceData](path)
		if readErr != nil {
			return nil, readErr
		}
		rm.loadedConfig = append(rm.loadedConfig, network.ConfigurationPayload{
			Type:     "quota-resource",
			FileName: path,
			Content:  config.Content,
		})
		quotaData = append(quotaData, config.UnmarshaledData)
	}
	return quotaData, nil
}

func (rm *ResourceManagement) loadQuotaResources(
	quotaData []*quotaresource.QuotaResourceData,
) error {
	for _, metaData := range quotaData {
		quotaResource, err := quotaresource.NewQuota(metaData)
		if err != nil {
			return err
		}

		log.Trace().Msgf("Adding quota resource with: ID %s, Filter: %v",
			metaData.Quota.ID,
			metaData.Quota.Filter,
		)

		for _, id := range quotaResource.GetIDs() {
			rm.quotas.Set(id, quotaResource)
		}

		for comparableFilter, systemFlow := range quotaResource.GetSystemFlow() {
			log.Trace().Msgf("Adding system flow with Key: %v", comparableFilter)
			log.Trace().Msgf("SystemFlowID: %v", systemFlow.GetID())
			if _, found := rm.flowData[comparableFilter]; !found {
				rm.flowData[comparableFilter] = systemFlow // resourceutils.NewSystemFlowRepresentation()
			} else {
				if err := rm.flowData[comparableFilter].AddSystemRepresentation(systemFlow); err != nil {
					return err
				}
			}
		}
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
