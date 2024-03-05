package remedy

import (
	"lunar/aggregation-plugin/common"
	sharedConfig "lunar/shared-model/config"
)

type AccessLog common.AccessLog

type Action int

const (
	ActionNoOp Action = iota
	ActionGenerated
	ActionModified
)

type Int int

type Aggregation struct {
	RemedyStats       map[RemedyWithAction]RemedyStats
	RemedyActionStats map[Action]CounterWithStatusCodes
	TotalCount        Int
	MaxEpochMillis    int64
	MinEpochMillis    int64
}

type RemedyWithAction struct { //nolint:revive
	Remedy sharedConfig.RemedyType
	Action Action
}

type AffectedStatsByEndpoint = map[common.Endpoint]CounterWithStatusCodes

type RemedyStats struct { //nolint:revive
	AffectedCount           Int
	AffectedStatsByEndpoint AffectedStatsByEndpoint
}

type CounterWithStatusCodes struct {
	Count       Int
	StatusCodes map[string]Int
}
