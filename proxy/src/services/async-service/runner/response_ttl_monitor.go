//go:build pro

package runner

import (
	"context"
	"fmt"
	"lunar/toolkit-core/otel"
	"net/http"
	"sync"
	"time"

	stream_types "lunar/engine/streams/types"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

const (
	responseTTLScanInterval = time.Minute
	responsesTTLedMetric    = "lunar_async_storage_responses_ttled"
)

type ResponseTTLMonitor struct {
	responses                 sync.Map
	responseTTLMonitorCounter metric.Int64Counter
}

type responseWatchEntry struct {
	statusCode  int
	host        string
	method      string
	consumerTag string
	flowName    string
	expiresAt   time.Time
}

func (r *responseWatchEntry) extractAttributes() []attribute.KeyValue {
	var attributes []attribute.KeyValue
	if r.host != "" {
		attributes = append(attributes, attribute.String("host", r.host))
	}
	if r.method != "" {
		attributes = append(attributes, attribute.String("http_method", r.method))
	}
	if r.consumerTag != "" {
		attributes = append(attributes, attribute.String("consumer_tag", r.consumerTag))
	}
	if r.flowName != "" {
		attributes = append(attributes, attribute.String("flow_name", r.flowName))
	}
	if r.statusCode != 0 {
		attributes = append(attributes, attribute.Int("status_code", r.statusCode))
	}
	return attributes
}

func NewResponseTTLMonitor() *ResponseTTLMonitor {
	return &ResponseTTLMonitor{
		responses: sync.Map{},
	}
}

func (r *ResponseTTLMonitor) Init() error {
	otelMeter := otel.GetMeter()
	responseTTLMonitorCounter, err := otelMeter.Int64Counter(
		responsesTTLedMetric,
		metric.WithDescription("Count of responses read by the clients that have exceeded their TTL"),
	)
	if err != nil {
		return fmt.Errorf("failed to create metric %s: %w", responsesTTLedMetric, err)
	}
	r.responseTTLMonitorCounter = responseTTLMonitorCounter
	r.start()
	return nil
}

func (r *ResponseTTLMonitor) Add(
	request *http.Request,
	response *stream_types.OnResponse,
	ttl time.Duration,
) {
	if r.responseTTLMonitorCounter == nil {
		return
	}

	rwe := responseWatchEntry{
		statusCode:  response.Status,
		method:      request.Method,
		host:        request.Header.Get("X-Lunar-Host"),
		consumerTag: request.Header.Get("X-Lunar-Consumer-Tag"),
		flowName:    request.Header.Get("X-Lunar-Async-Flow"),
		expiresAt:   time.Now().Add(ttl),
	}
	r.responses.Store(response.GetID(), rwe)
}

func (r *ResponseTTLMonitor) start() {
	ctx := context.Background()
	ticker := time.NewTicker(responseTTLScanInterval)
	go func() {
		for {
			select {
			case <-ticker.C:
				r.scanOnce(ctx)
			case <-ctx.Done():
				ticker.Stop()
				return
			}
		}
	}()
}

func (r *ResponseTTLMonitor) scanOnce(ctx context.Context) {
	now := time.Now()
	r.responses.Range(func(key, value any) bool {
		entry := value.(responseWatchEntry)
		if now.After(entry.expiresAt) {
			r.responseTTLMonitorCounter.Add(ctx, 1, metric.WithAttributes(entry.extractAttributes()...))
			r.responses.Delete(key)
		}
		return true
	})
}
