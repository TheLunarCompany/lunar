package quotaresource

import (
	streamconfig "lunar/engine/streams/config"
	publictypes "lunar/engine/streams/public-types"
	resourcetypes "lunar/engine/streams/resources/types"
	streamtypes "lunar/engine/streams/types"
)

type QuotaResource struct {
	ID             string
	Strategy       UsedStrategy // This could be removed in case of specific resource initialization
	context        publictypes.ContextI
	metaData       *QuotaMetaData
	systemFlowData *resourcetypes.ResourceFlowData
}

func NewQuota(metaData *QuotaMetaData) *QuotaResource {
	quota := &QuotaResource{
		ID:       metaData.GetID(),
		context:  streamtypes.NewContextManager().GetGlobalContext(),
		metaData: metaData,
	}
	quota.init()
	// TODO: Implement initialization logic to populate the resourceProcessor map
	// and select needed strategy
	return quota
}

func (q *QuotaResource) GetMetaData() *QuotaMetaData {
	return q.metaData
}

func (q *QuotaResource) GetSystemFlow() *resourcetypes.ResourceFlowData {
	return q.systemFlowData
}

func (q *QuotaResource) Update(_ publictypes.QuotaMetaDataI) error {
	// TODO: Implement update logic
	return nil
}

func (q *QuotaResource) init() {
	q.generateSystemFlowData()
}

func (q *QuotaResource) generateSystemFlowData() {
	q.systemFlowData = &resourcetypes.ResourceFlowData{
		Filter:                q.metaData.GetFilter(),
		Processors:            q.getProcessors(),
		ProcessorsConnections: q.getProcessorsLocation(),
		ID:                    q.ID,
	}
}

func (q *QuotaResource) getProcessors() map[string]publictypes.ProcessorDataI {
	return map[string]publictypes.ProcessorDataI{
		q.ID + "_QuotaProcessorInc": &streamconfig.Processor{
			Processor: "QuotaProcessorInc",
			Parameters: []publictypes.KeyValue{
				{
					Key:   "quotaID",
					Value: q.ID,
				},
			},
		},
		q.ID + "_QuotaProcessorDec": &streamconfig.Processor{
			Processor: "QuotaProcessorDec",
			Parameters: []publictypes.KeyValue{
				{
					Key:   "quotaID",
					Value: q.ID,
				},
			},
		},
	}
}

func (q *QuotaResource) getProcessorsLocation() publictypes.ResourceFlowI {
	return &resourcetypes.ResourceFlow{
		Request: &resourcetypes.ResourceProcessorLocation{
			Start: []string{q.ID + "_QuotaProcessorInc"},
		},
		Response: &resourcetypes.ResourceProcessorLocation{
			End: []string{q.ID + "_QuotaProcessorDec"},
		},
	}
}
