//go:build !pro

package lunarcluster

import (
	interfaces "lunar/toolkit-core/interfaces"
)

type ClusterLiveness struct {
	instanceID string
}

func NewLunarCluster(instanceID string) (interfaces.ClusterLivenessI, error) {
	return &ClusterLiveness{
		instanceID: instanceID,
	}, nil
}

func (lc *ClusterLiveness) GetInstanceID() string {
	return lc.instanceID
}

func (lc *ClusterLiveness) GetPeerIDs() []string {
	return []string{lc.instanceID}
}

func (lc *ClusterLiveness) IsPartOfCluster(_ string) bool {
	return true
}

func (lc *ClusterLiveness) Stop() {}
