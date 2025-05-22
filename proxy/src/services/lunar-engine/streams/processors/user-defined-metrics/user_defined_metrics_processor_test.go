package userdefinedmetrics_test

import (
	"context"
	"lunar/toolkit-core/otel"
	"testing"

	userdefinedmetrics "lunar/engine/streams/processors/user-defined-metrics"
	public_types "lunar/engine/streams/public-types"
	test_utils "lunar/engine/streams/test-utils"
	streamtypes "lunar/engine/streams/types"

	"github.com/samber/lo"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
	sdkMetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
)

func TestMetricExtractionWithCustomLabels(t *testing.T) {
	stream := test_utils.NewMockAPIStreamFull(public_types.StreamTypeResponse, "GET",
		"https://example.com/org789/orders?resource_id=res456&limit=10",
		map[string]string{
			"x-api-key":     "key123",
			"Authorization": "Bearer token",
			"user-agent":    "Mozilla/5.0",
		},
		map[string]string{"Content-Type": "application/json"},
		`{"dummy":"request"}`,
		// response body - Gemini inspired
		`{
			"modelVersion": "gemini-2.0-flash-exp",
			"candidates": [
				{
					"content": {
						"parts": [
							{"text": "some preliminary intro" },
							{
								"functionCall": {
									"name": "google-maps__maps_distance_matrix",
									"args": {
										"destinations": ["Statue of Liberty"],
										"origins": ["Empire State Building"]
									}
								}
							}
						],
						"role": "model"
					}
				}
			]
		}`,
		200,
	)

	exporter := initMeter(t)
	proc := createProcessor(
		t,
		"used_tool",
		"counter",
		"api_call_count", // This `metric_value` simply signifies incrementing by 1
		map[string]string{
			// Ideally, this would be: "$.response.body.candidates[0].content.parts[?($.functionCall.name)].functionCall.name"
			// so we are not hardcoding the position. However the underlying JSONPath library does not support this.
			"tool_used": "$.response.body.candidates[0].content.parts[1].functionCall.name",
			"model":     "$.response.body.modelVersion",
		},
	)

	_, err := proc.Execute("transform-test", stream)
	require.NoError(t, err)

	scrape := scrapeAll(t, exporter)
	require.NotNil(t, scrape)
	require.Equal(t, 1, len(scrape.ScopeMetrics))

	scopeMetric := scrape.ScopeMetrics[0]
	require.Equal(t, 1, len(scopeMetric.Metrics))

	metric := scopeMetric.Metrics[0]
	require.Equal(t, "lunar_used_tool", metric.Name)

	sum, ok := metric.Data.(metricdata.Sum[float64])
	require.True(t, ok)
	require.Equal(t, 1, len(sum.DataPoints))

	dataPoint := sum.DataPoints[0]
	require.Equal(t, 1.0, dataPoint.Value)

	attrs := dataPoint.Attributes.ToSlice()
	require.Equal(t, 2, len(attrs))

	toolUsedAttr, found := lo.Find(attrs, func(attr attribute.KeyValue) bool {
		return attr.Key == "tool_used"
	})
	require.True(t, found)
	require.Equal(t, "google-maps__maps_distance_matrix", toolUsedAttr.Value.AsString())

	modelAttr, found := lo.Find(attrs, func(attr attribute.KeyValue) bool {
		return attr.Key == "model"
	})
	require.True(t, found)
	require.Equal(t, "gemini-2.0-flash-exp", modelAttr.Value.AsString())
}

func createProcessor(
	t *testing.T,
	metricName, metricType, metricValue string,
	customMetricLabels map[string]string,
) streamtypes.ProcessorI {
	params := map[string]streamtypes.ProcessorParam{}
	params["metric_name"] = streamtypes.ProcessorParam{
		Name:  "metric_name",
		Value: public_types.NewParamValue(metricName),
	}
	params["metric_type"] = streamtypes.ProcessorParam{
		Name:  "metric_type",
		Value: public_types.NewParamValue(metricType),
	}
	params["metric_value"] = streamtypes.ProcessorParam{
		Name:  "metric_value",
		Value: public_types.NewParamValue(metricValue),
	}
	params["custom_metric_labels"] = streamtypes.ProcessorParam{
		Name:  "custom_metric_labels",
		Value: public_types.NewParamValue(customMetricLabels),
	}

	metaData := &streamtypes.ProcessorMetaData{
		Name:       "UserDefinedMetrics",
		Parameters: params,
	}
	proc, err := userdefinedmetrics.NewProcessor(metaData)
	require.NoError(t, err)
	return proc
}

func initMeter(t *testing.T) *sdkMetric.ManualReader {
	t.Helper()

	reader := sdkMetric.NewManualReader()
	meterProvider := sdkMetric.NewMeterProvider(sdkMetric.WithReader(reader))
	otel.SetRealMeter(meterProvider.Meter("test-meter"))
	return reader
}

func scrapeAll(t *testing.T, read *sdkMetric.ManualReader) *metricdata.ResourceMetrics {
	t.Helper()

	collectedMetrics := &metricdata.ResourceMetrics{}
	err := read.Collect(context.Background(), collectedMetrics)
	require.NoError(t, err)

	return collectedMetrics
}
