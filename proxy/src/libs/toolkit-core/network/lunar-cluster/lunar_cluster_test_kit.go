package lunarcluster

type TestLunarCluster struct {
	instanceID string
	peers      []string
}

func NewTestLunarCluster() *TestLunarCluster {
	return &TestLunarCluster{}
}

func (lc *TestLunarCluster) GetInstanceID() string {
	return lc.instanceID
}

func (lc *TestLunarCluster) GetPeerIDs() []string {
	return lc.peers
}

func (lc *TestLunarCluster) IsPartOfCluster(_ string) bool {
	return true
}

func (lc *TestLunarCluster) Stop() {}

// Setters for testing
func (lc *TestLunarCluster) SetInstanceID(instanceID string) *TestLunarCluster {
	lc.instanceID = instanceID
	return lc
}

func (lc *TestLunarCluster) SetPeers(peers ...string) *TestLunarCluster {
	lc.peers = peers
	return lc
}
