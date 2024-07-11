package quotaresource

import (
	streamtypes "lunar/engine/streams/types"
)

type QuotaResource struct {
	ID                string
	Strategy          UsedStrategy // This could be removed in case of specific resource initialization
	context           streamtypes.ContextI
	metaData          *QuotaMetaData
	resourceProcessor map[streamtypes.StreamType][]streamtypes.ProcessorMetaData
}

func NewQuota(metaData *QuotaMetaData) *QuotaResource {
	quota := &QuotaResource{
		ID:                metaData.ID,
		context:           streamtypes.NewContextManager().GetGlobalContext(),
		metaData:          metaData,
		resourceProcessor: make(map[streamtypes.StreamType][]streamtypes.ProcessorMetaData),
	}
	// TODO: Implement initialization logic to populate the resourceProcessor map
	// and select needed strategy
	return quota
}

func (q *QuotaResource) Update(_ *QuotaMetaData) error {
	// TODO: Implement update logic
	return nil
}
