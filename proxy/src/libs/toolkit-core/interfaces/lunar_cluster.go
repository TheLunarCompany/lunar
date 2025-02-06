package interfaces

type ClusterLivenessI interface {
	GetInstanceID() string
	IsPartOfCluster(string) bool
	Stop()
}
