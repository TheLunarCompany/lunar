package remedy

import (
	sharedConfig "lunar/shared-model/config"
)

// The persisted aggregation model is similar to the aggregation model
// but avoids structs as map keys, which are not supported in JSON.
// They are highly useful and efficient in the aggregation model
// since they play very well with the semigroup pattern.

type Output struct {
	RemedyStats       []OutputStats                `json:"remedy_stats"`
	RemedyActionStats map[Action]OutputActionStats `json:"remedy_action_stats"`
	MaxTime           string                       `json:"max_time"`
	MinTime           string                       `json:"min_time"`
}

type Internal struct {
	TotalCount Int `json:"total_count"`
}
type OutputStats struct {
	Remedy                  sharedConfig.RemedyType       `json:"remedy"`
	Action                  Action                        `json:"action"`
	AffectedCount           Int                           `json:"affected_count"`
	AffectedRatio           float32                       `json:"affected_ratio"`
	AffectedStatsByEndpoint []OutputEndpointAffectedStats `json:"affected_stats_by_endpoint"`
}

type OutputEndpointAffectedStats struct {
	Method            string         `json:"method"`
	URL               string         `json:"url"`
	Count             Int            `json:"count"`
	CountByStatusCode map[string]Int `json:"count_by_status_code"`
}

type OutputActionStats struct {
	Count             Int                `json:"count"`
	Ratio             float32            `json:"ratio"`
	RatioByStatusCode map[string]float32 `json:"ratio_by_status_code"`
}
