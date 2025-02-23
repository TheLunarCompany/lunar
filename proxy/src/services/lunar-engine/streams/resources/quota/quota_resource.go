package quotaresource

import (
	"context"
	"fmt"
	"lunar/toolkit-core/otel"

	publictypes "lunar/engine/streams/public-types"
	resourceutils "lunar/engine/streams/resources/utils"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

const (
	quotaProcessorInc  = "QuotaProcessorInc"
	quotaProcessorDec  = "QuotaProcessorDec"
	quotaParamKey      = "quota_id"
	applyLogicParamKey = "should_apply_logic"

	quotaUsedMetricName  = "lunar_resources_quota_resource_quota_used"
	quotaLimitMetricName = "lunar_resources_quota_resource_quota_limit"
)

type quotaResource struct {
	quotaTrie *resourceutils.QuotaTrie[ResourceAdmI]
	ids       []string
	flowData  map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation
	metadata  *SingleQuotaResourceData

	definedQuotas map[string]int64

	quotaUsedMetric  metric.Int64ObservableGauge
	quotaLimitMetric metric.Int64ObservableGauge
}

func NewQuota(metadata *SingleQuotaResourceData) (QuotaAdmI, error) {
	if metadata == nil {
		return nil, fmt.Errorf("metadata is nil")
	}

	quota := &quotaResource{
		ids:           []string{metadata.Quota.ID},
		metadata:      metadata,
		definedQuotas: map[string]int64{},
		flowData: make(
			map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation,
		),
	}

	if err := quota.init(); err != nil {
		return nil, fmt.Errorf("failed to initialize quota resource: %w", err)
	}

	if err := quota.initMetrics(); err != nil {
		return nil, fmt.Errorf("failed to initialize metrics: %w", err)
	}

	return quota, nil
}

func (q *quotaResource) GetMetaData() *SingleQuotaResourceData {
	return q.metadata
}

func (q *quotaResource) GetIDs() []string {
	return q.ids
}

func (q *quotaResource) GetSystemFlow() map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation { //nolint: lll
	return q.flowData
}

func (q *quotaResource) Update(metadata *SingleQuotaResourceData) error {
	q.metadata = metadata
	return q.init()
}

func (q *quotaResource) GetQuota(ID string) (publictypes.QuotaResourceI, error) {
	return q.getQuota(ID)
}

func (q *quotaResource) getQuota(ID string) (ResourceAdmI, error) {
	quotaNode := q.quotaTrie.GetNode(ID)
	if quotaNode == nil {
		return nil, fmt.Errorf("quota with ID %s not found", ID)
	}

	return quotaNode.GetQuota(), nil
}

func (q *quotaResource) initMetrics() error {
	log.Info().Msg("Initializing quota metrics")
	meter := otel.GetMeter()

	quotaUsedMetric, err := meter.Int64ObservableGauge(
		quotaUsedMetricName,
		metric.WithDescription("Used quota for quota resource"),
		metric.WithInt64Callback(q.observeQuotaUsed),
	)
	if err != nil {
		return fmt.Errorf("failed to initialize used quota metric: %w", err)
	}

	quotaLimitMetric, err := meter.Int64ObservableGauge(
		quotaLimitMetricName,
		metric.WithDescription("Limits for quota resource"),
		metric.WithInt64Callback(q.observeQuotaLimit),
	)
	if err != nil {
		return fmt.Errorf("failed to initialize quota limit metric: %w", err)
	}

	q.quotaUsedMetric = quotaUsedMetric
	q.quotaLimitMetric = quotaLimitMetric

	return nil
}

func (q *quotaResource) init() error {
	var err error
	usedStrategy := q.metadata.Quota.Strategy.GetUsedStrategy()
	strategy, err := usedStrategy.CreateStrategy(q.metadata.Quota)
	if err != nil {
		return err
	}

	q.definedQuotas[strategy.GetID()] = strategy.GetLimit()

	nodeConf := &resourceutils.NodeConfig{
		ID:     q.metadata.Quota.ID,
		Filter: q.metadata.Quota.Filter,
	}
	q.quotaTrie = resourceutils.NewQuotaTrie(nodeConf, strategy)
	err = q.addSystemFlow(strategy)
	if err != nil {
		return err
	}
	for _, internalLimit := range q.metadata.InternalLimits {
		var quota ResourceAdmI
		q.ids = append(q.ids, internalLimit.ID)
		parentNode := q.quotaTrie.GetNode(internalLimit.ParentID)
		if internalLimit.Filter == nil {
			internalLimit.Filter = parentNode.GetFilter()
		} else {
			internalLimit.Filter.Extend(parentNode.GetFilter())
		}

		if internalLimit.Strategy.AllocationPercentage != 0 {
			parentQuota := parentNode.GetQuota()

			err = AssignQuotaLimitForPercentageAllocation(
				internalLimit.Strategy,
				parentQuota.GetStrategyConfig(),
			)
			if err != nil {
				return err
			}

			log.Debug().
				Str("internal-limit-quota-id", internalLimit.ID).
				Str("parent-quota-id", parentQuota.GetID()).
				Msg("Turned PercentageAllocation strategy into actual Strategy")
		}
		quota, err = internalLimit.Strategy.GetUsedStrategy().
			CreateChildStrategy(&internalLimit.QuotaConfig, parentNode)
		if err != nil {
			return err
		}

		q.definedQuotas[quota.GetID()] = quota.GetLimit()

		err = q.addSystemFlow(quota)
		if err != nil {
			return err
		}
		nodeConf := &resourceutils.NodeConfig{
			ID:       internalLimit.ID,
			ParentID: internalLimit.ParentID,
			Filter:   internalLimit.Filter,
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

func (q *quotaResource) observeQuotaLimit(
	_ context.Context,
	observer metric.Int64Observer,
) error {
	for quotaID, quota := range q.definedQuotas {
		observer.Observe(
			int64(quota),
			metric.WithAttributes(
				attribute.String("quota_id", quotaID),
			),
		)
	}

	return nil
}

func (q *quotaResource) observeQuotaUsed(
	_ context.Context,
	observer metric.Int64Observer,
) error {
	log.Debug().Msg("Observing quota used")
	for quotaID := range q.definedQuotas {
		log.Debug().Msgf("Quota ID: %s", quotaID)
		quota, err := q.getQuota(quotaID)
		if err != nil {
			log.Error().Err(err).Msg("Failed to get quota")
			continue
		}
		groupCounters := quota.GetQuotaGroupsCounters()
		log.Debug().Msgf("Group counters: %v", groupCounters)
		for groupID, counter := range groupCounters {
			attributes := []attribute.KeyValue{
				attribute.String("group_id", groupID),
				attribute.String("quota_id", quotaID),
			}
			observer.Observe(int64(counter), metric.WithAttributes(attributes...))
		}
	}
	return nil
}
