package quotaresource

import (
	"fmt"
	publictypes "lunar/engine/streams/public-types"
	resourceutils "lunar/engine/streams/resources/utils"
	"lunar/toolkit-core/clock"
)

const (
	quotaProcessorInc = "QuotaProcessorInc"
	quotaProcessorDec = "QuotaProcessorDec"
	quotaParamKey     = "quota_id"
)

type quotaResource struct {
	quotaTrie *resourceutils.QuotaTrie[ResourceAdmI]
	clock     clock.Clock
	ids       []string
	flowData  map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation
	metadata  *QuotaResourceData
}

func NewQuota(
	clock clock.Clock,
	metadata *QuotaResourceData,
) (QuotaAdmI, error) {
	if metadata == nil {
		return nil, fmt.Errorf("metadata is nil")
	}

	quota := &quotaResource{
		clock:    clock,
		ids:      []string{metadata.Quota.ID},
		metadata: metadata,
		flowData: make(map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation),
	}

	if err := quota.init(); err != nil {
		return nil, fmt.Errorf("failed to initialize quota resource: %w", err)
	}

	return quota, nil
}

func (q *quotaResource) GetMetaData() *QuotaResourceData {
	return q.metadata
}

func (q *quotaResource) GetIDs() []string {
	return q.ids
}

func (q *quotaResource) GetSystemFlow() map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation { //nolint: lll
	return q.flowData
}

func (q *quotaResource) Update(metadata *QuotaResourceData) error {
	q.metadata = metadata
	return q.init()
}

func (q *quotaResource) GetQuota(ID string) (publictypes.QuotaResourceI, error) {
	quotaNode := q.quotaTrie.GetNode(ID)
	if quotaNode == nil {
		return nil, fmt.Errorf("quota with ID %s not found", ID)
	}
	return quotaNode.GetQuota(), nil
}

func (q *quotaResource) init() error {
	var err error
	usedStrategy := q.metadata.Quota.Strategy.GetUsedStrategy()
	strategy, err := usedStrategy.CreateStrategy(
		q.clock,
		q.metadata.Quota,
	)
	if err != nil {
		return err
	}
	nodeConf := &resourceutils.NodeConfig{
		ID:     q.metadata.Quota.ID,
		Filter: q.metadata.Quota.Filter,
	}
	q.quotaTrie = resourceutils.NewQuotaTrie(nodeConf, strategy)
	err = q.addSystemFlow(strategy)
	if err != nil {
		return err
	}
	for _, nodeData := range q.metadata.InternalLimits {
		var quota ResourceAdmI
		q.ids = append(q.ids, nodeData.ID)
		parentNode := q.quotaTrie.GetNode(nodeData.ParentID)
		if nodeData.Filter == nil {
			nodeData.Filter = parentNode.GetFilter()
		}
		nodeData.Filter.Extend(parentNode.GetFilter())
		quota, err = nodeData.Strategy.GetUsedStrategy().CreateChildStrategy(
			q.clock,
			&nodeData.QuotaConfig,
			parentNode,
		)
		if err != nil {
			return err
		}
		err = q.addSystemFlow(quota)
		if err != nil {
			return err
		}
		nodeConf := &resourceutils.NodeConfig{
			ID:       nodeData.ID,
			ParentID: nodeData.ParentID,
			Filter:   nodeData.Filter,
		}

		_, err = parentNode.AddNode(nodeConf, quota)
		if err != nil {
			return err
		}
	}
	return nil
}

func (q *quotaResource) addSystemFlow(quota ResourceAdmI) error {
	systemFlow := quota.GetSystemFlow()
	if systemFlow == nil {
		return nil
	}
	comparableFilter := systemFlow.Filter.ToComparable()
	_, found := q.flowData[comparableFilter]
	if !found {
		q.flowData[comparableFilter] = resourceutils.NewSystemFlowRepresentation()
	}
	return q.flowData[comparableFilter].AddSystemFlow(quota.GetSystemFlow())
}
