package resources

import (
	"fmt"
	publictypes "lunar/engine/streams/public-types"
	pathparamsresource "lunar/engine/streams/resources/path_params"
	quotaresource "lunar/engine/streams/resources/quota"
	resourceutils "lunar/engine/streams/resources/utils"
	streamtypes "lunar/engine/streams/types"
	"lunar/toolkit-core/network"

	"github.com/rs/zerolog/log"
)

type ResourceManagement struct {
	pathParams   *pathparamsresource.PathParams
	quotaLoader  *quotaresource.Loader
	quotas       *resourceutils.Resource[quotaresource.QuotaAdmI]
	reqIDToQuota publictypes.ContextI
	flowData     map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation
	loadedConfig []network.ConfigurationPayload
}

func NewResourceManagement() (*ResourceManagement, error) {
	quotaLoader, err := quotaresource.NewLoader()
	if err != nil {
		return nil, err
	}

	return newResourceManagement(pathparamsresource.NewPathParams(), quotaLoader)
}

func NewValidationResourceManagement(dir string) (*ResourceManagement, error) {
	quotaLoader, err := quotaresource.NewValidationLoader(dir)
	if err != nil {
		return nil, err
	}

	return newResourceManagement(pathparamsresource.NewValidationPathParams(dir), quotaLoader)
}

func (rm *ResourceManagement) WithQuotaData(
	quotaData []*quotaresource.QuotaResourceData,
) (*ResourceManagement, error) {
	var err error
	rm.quotaLoader, err = rm.quotaLoader.WithData(quotaData)
	if err != nil {
		return nil, err
	}
	err = rm.setQuotaData()
	if err != nil {
		return nil, err
	}

	return rm, nil
}

func (rm *ResourceManagement) SetPathParams(URL string) error {
	return rm.pathParams.SetPathParams(URL)
}

func (rm *ResourceManagement) GeneratePathParamConfFile() error {
	return rm.pathParams.GeneratePathParamConfFile()
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
	metaData *quotaresource.SingleQuotaResourceData,
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
		log.Trace().Msgf("System flow data with filter %v not found", filter)
		return flowRepresentation, nil
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
	return rm.setQuotaData()
}

func (rm *ResourceManagement) setQuotaData() error {
	rm.loadedConfig = append(rm.loadedConfig, rm.quotaLoader.GetLoadedConfig()...)
	for _, quota := range rm.quotaLoader.GetQuotas().GetAll() {
		for _, id := range quota.GetIDs() {
			rm.quotas.Set(id, quota)
		}
	}

	for filter, systemFlow := range rm.quotaLoader.GetFlowData() {
		if _, found := rm.flowData[filter]; !found {
			rm.flowData[filter] = systemFlow
		} else {
			if err := rm.flowData[filter].AddSystemRepresentation(systemFlow); err != nil {
				return err
			}
		}
	}
	return nil
}

func newResourceManagement(
	pathParams *pathparamsresource.PathParams,
	quotaLoader *quotaresource.Loader,
) (*ResourceManagement, error) {
	management := &ResourceManagement{
		pathParams:   pathParams,
		loadedConfig: []network.ConfigurationPayload{},
		quotas:       resourceutils.NewResource[quotaresource.QuotaAdmI](),
		reqIDToQuota: streamtypes.NewContext(),
		flowData:     make(map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation),
	}

	management.quotaLoader = quotaLoader
	if err := management.init(); err != nil {
		return nil, err
	}
	return management, nil
}
