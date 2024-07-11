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

func NewQuota(metaData *QuotaMetaData, context streamtypes.ContextI) *QuotaResource {
	quota := &QuotaResource{
		ID:                metaData.ID,
		context:           context,
		metaData:          metaData,
		resourceProcessor: make(map[streamtypes.StreamType][]streamtypes.ProcessorMetaData),
	}
	// TODO: Implement initialization logic to populate the resourceProcessor map
	// and select needed strategy
	return quota
}
