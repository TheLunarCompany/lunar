package remedy_test

import (
	"lunar/aggregation-plugin/common"
	"lunar/aggregation-plugin/remedy"
	sharedActions "lunar/shared-model/actions"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

var successRecord = common.AccessLog{
	Timestamp:              time.Now().UnixMilli(),
	Duration:               0,
	StatusCode:             200,
	Method:                 "GET",
	Host:                   "twitter.com",
	URL:                    "twitter.com/users/{id}",
	RequestActiveRemedies:  common.RequestActiveRemedies{},
	ResponseActiveRemedies: common.ResponseActiveRemedies{},
}

var providerThrottledRecord = common.AccessLog{
	Timestamp:              time.Now().UnixMilli(),
	Duration:               0,
	StatusCode:             429,
	Method:                 "GET",
	Host:                   "twitter.com",
	URL:                    "twitter.com/users/{id}",
	RequestActiveRemedies:  common.RequestActiveRemedies{},
	ResponseActiveRemedies: common.ResponseActiveRemedies{},
}

var responseBasedThrottledRecord = common.AccessLog{
	Timestamp:  time.Now().UnixMilli(),
	Duration:   0,
	StatusCode: 429,
	Method:     "GET",
	Host:       "twitter.com",
	URL:        "twitter.com/users/{id}",
	RequestActiveRemedies: common.RequestActiveRemedies{
		sharedConfig.RemedyResponseBasedThrottling: []sharedActions.RemedyReqRunResult{ //nolint:lll
			sharedActions.ReqObtainedResponse,
		},
	},
	ResponseActiveRemedies: common.ResponseActiveRemedies{},
}

var anotherEndpointResponseBasedThrottled = common.AccessLog{
	Timestamp:  time.Now().UnixMilli(),
	Duration:   0,
	StatusCode: 429,
	Method:     "POST",
	Host:       "api.com",
	URL:        "api.com/weather/tel-aviv",
	RequestActiveRemedies: common.RequestActiveRemedies{
		sharedConfig.RemedyResponseBasedThrottling: []sharedActions.RemedyReqRunResult{ //nolint:lll
			sharedActions.ReqObtainedResponse,
		},
	},
	ResponseActiveRemedies: common.ResponseActiveRemedies{},
}

var twitterUserIDEndpoint = common.Endpoint{
	Method: "GET",
	URL:    "twitter.com/users/{id}",
}
var apiComEndpoint = common.Endpoint{Method: "POST", URL: "api.com"}

func TestAddingRecordsToToEmptyAgg(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	tree := buildTree(t)

	currentAgg := remedy.Aggregation{}
	records := []common.AccessLog{
		successRecord,
		providerThrottledRecord,
		responseBasedThrottledRecord,
		anotherEndpointResponseBasedThrottled,
	}
	newAgg := remedy.GetUpdatedAggregations(currentAgg, records, tree, clock)
	wantRemedyWithAction := remedy.RemedyWithAction{
		Remedy: sharedConfig.RemedyResponseBasedThrottling,
		Action: remedy.Action(sharedActions.ReqObtainedResponse),
	}
	wantRemedyStats := remedy.RemedyStats{
		AffectedCount: 2,
		AffectedStatsByEndpoint: remedy.AffectedStatsByEndpoint{
			twitterUserIDEndpoint: remedy.CounterWithStatusCodes{
				Count:       1,
				StatusCodes: map[string]remedy.Int{"429": remedy.Int(1)},
			},
			apiComEndpoint: remedy.CounterWithStatusCodes{
				Count:       1,
				StatusCodes: map[string]remedy.Int{"429": remedy.Int(1)},
			},
		},
	}
	wantActionStats := map[remedy.Action]remedy.CounterWithStatusCodes{
		remedy.ActionGenerated: {
			Count:       2,
			StatusCodes: map[string]remedy.Int{"429": remedy.Int(2)},
		},
	}
	wantAgg := remedy.Aggregation{
		RemedyStats: map[remedy.RemedyWithAction]remedy.RemedyStats{
			wantRemedyWithAction: wantRemedyStats,
		},
		TotalCount:        4,
		RemedyActionStats: wantActionStats,
		MaxEpochMillis:    clock.Now().UnixMilli(),
		MinEpochMillis:    clock.Now().UnixMilli(),
	}

	assert.Equal(t, wantAgg, newAgg)
}

func TestAddingRecordsToToExistingAgg(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	tree := buildTree(t)

	currentRemedyWithAction := remedy.RemedyWithAction{
		Remedy: sharedConfig.RemedyResponseBasedThrottling,
		Action: remedy.Action(sharedActions.ReqObtainedResponse),
	}
	currentRemedyStats := remedy.RemedyStats{
		AffectedCount: 3,
		AffectedStatsByEndpoint: remedy.AffectedStatsByEndpoint{
			twitterUserIDEndpoint: remedy.CounterWithStatusCodes{
				Count:       3,
				StatusCodes: map[string]remedy.Int{"429": remedy.Int(3)},
			},
		},
	}
	currentActionStats := map[remedy.Action]remedy.CounterWithStatusCodes{
		remedy.ActionGenerated: {
			Count:       3,
			StatusCodes: map[string]remedy.Int{"429": remedy.Int(3)},
		},
	}
	currentAgg := remedy.Aggregation{
		RemedyStats: map[remedy.RemedyWithAction]remedy.RemedyStats{
			currentRemedyWithAction: currentRemedyStats,
		},
		TotalCount:        4,
		RemedyActionStats: currentActionStats,
		MaxEpochMillis:    clock.Now().UnixMilli(),
		MinEpochMillis:    clock.Now().UnixMilli(),
	}

	records := []common.AccessLog{
		successRecord,
		providerThrottledRecord,
		responseBasedThrottledRecord,
		anotherEndpointResponseBasedThrottled,
	}
	newAgg := remedy.GetUpdatedAggregations(currentAgg, records, tree, clock)

	wantRemedyStats := remedy.RemedyStats{
		AffectedCount: 5,
		AffectedStatsByEndpoint: remedy.AffectedStatsByEndpoint{
			twitterUserIDEndpoint: remedy.CounterWithStatusCodes{
				Count:       4,
				StatusCodes: map[string]remedy.Int{"429": remedy.Int(4)},
			},
			apiComEndpoint: remedy.CounterWithStatusCodes{
				Count:       1,
				StatusCodes: map[string]remedy.Int{"429": remedy.Int(1)},
			},
		},
	}

	wantActionStats := map[remedy.Action]remedy.CounterWithStatusCodes{
		remedy.ActionGenerated: {
			Count:       5,
			StatusCodes: map[string]remedy.Int{"429": remedy.Int(5)},
		},
	}

	wantAgg := remedy.Aggregation{
		RemedyStats: map[remedy.RemedyWithAction]remedy.RemedyStats{
			currentRemedyWithAction: wantRemedyStats,
		},
		TotalCount:        8,
		RemedyActionStats: wantActionStats,
		MaxEpochMillis:    clock.Now().UnixMilli(),
		MinEpochMillis:    clock.Now().UnixMilli(),
	}

	assert.Equal(t, wantAgg, newAgg)
}

func buildTree(t *testing.T) *common.SimpleURLTree {
	endpointA := common.Endpoint{
		Method: "GET",
		URL:    "twitter.com/users/{id}",
	}

	tree, err := common.BuildTree(
		common.KnownEndpoints{
			Endpoints: []common.Endpoint{endpointA},
		},
	)

	assert.Nil(t, err)
	return tree
}
