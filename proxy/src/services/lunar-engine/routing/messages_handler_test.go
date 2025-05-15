package routing

import (
	"context"
	"fmt"
	"lunar/engine/metrics"
	"lunar/engine/streams"
	context_manager "lunar/toolkit-core/context-manager"
	"os"
	"os/signal"
	"syscall"
	"testing"

	"github.com/negasus/haproxy-spoe-go/message"
	"github.com/negasus/haproxy-spoe-go/payload/kv"
	"github.com/negasus/haproxy-spoe-go/request"
	"github.com/stretchr/testify/require"
)

func TestCustomResponseReturnWhenContextIsClose(t *testing.T) {
	handlingDataManager := NewHandlingDataManager(10, nil)
	handlingDataManager.isStreamsEnabled = true
	metricManager, err := metrics.NewMetricManager()
	require.Error(t, err)

	handlingDataManager.metricManager = metricManager

	err = initializeFlows(handlingDataManager)
	require.NoError(t, err)

	messageHandler := Handler(handlingDataManager)

	ctx, cancelCtx := signal.NotifyContext(context.Background(),
		os.Interrupt, os.Kill, syscall.SIGTTIN, syscall.SIGTERM)

	ctxMng := context_manager.Get()
	ctxMng.WithContext(ctx)
	cancelCtx() // We close the context here to simulate a closed context.

	keyValues := kv.NewKV()
	keyValues.Add("id", "test")
	keyValues.Add("sequence_id", "1")
	keyValues.Add("method", "GET")
	keyValues.Add("schema", "http")
	keyValues.Add("url", "a.b.c/d")
	keyValues.Add("path", "/d")
	keyValues.Add("query", "")
	keyValues.Add("headers", "")
	keyValues.Add("body", []byte(""))

	req := request.Request{
		Messages: &message.Messages{
			{
				Name: "lunar-on-request",
				KV:   keyValues,
			},
		},
	}
	messageHandler(&req)
	require.Equal(t, getShutdownActions(), req.Actions)
}

func initializeFlows(handlingDataManager *HandlingDataManager) error {
	stream, err := streams.NewStream()
	if err != nil {
		return fmt.Errorf("failed to create stream: %w", err)
	}
	handlingDataManager.stream = stream

	if err = handlingDataManager.stream.Initialize(); err != nil {
		return fmt.Errorf("failed to initialize streams: %w", err)
	}

	return nil
}
