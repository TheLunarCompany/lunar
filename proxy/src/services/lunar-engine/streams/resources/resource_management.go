package resources

import (
	quotaresource "lunar/engine/streams/resources/quota"
	streamtypes "lunar/engine/streams/types"
)

type ResourceManagement struct {
	quota   map[string]*quotaresource.QuotaResource
	context streamtypes.ContextI
}

func NewResourceManagement(context streamtypes.ContextI) *ResourceManagement {
	rm := &ResourceManagement{
		quota:   make(map[string]*quotaresource.QuotaResource),
		context: context,
	}
	// TODO: Implement initialization logic to populate the quota map
	return rm
}

// TODO: Implement complete ResourceManagement struct if needed
// TODO: Implement needed functions for the ResourceManagement struct
