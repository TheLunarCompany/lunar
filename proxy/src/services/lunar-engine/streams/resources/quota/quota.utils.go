package quotaresource

import (
	streamconfig "lunar/engine/streams/config"
)

func (q *QuotaMetaData) GetID() string {
	return q.ID
}

func (q *QuotaMetaData) GetFilter() *streamconfig.Filter {
	return q.Filter
}

func (q *QuotaMetaData) GetStrategy() *Strategy {
	return q.Strategy
}
