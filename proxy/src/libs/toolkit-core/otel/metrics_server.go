package otel

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/zerolog/log"
)

func ServeMetrics() {
	log.Debug().Msgf("Serving metrics at %s%s", prometheusHost, metricsRoute)
	http.Handle(metricsRoute, promhttp.Handler())
	err := http.ListenAndServe(prometheusHost, nil)
	if err != nil {
		log.Error().Err(err).Msg("Error starting metrics endpoint")
	}
}

func ServeMetricsForAsyncService() {
	log.Debug().Msgf("Serving metrics for AsyncService at %s%s", metricsAsyncServiceHost, metricsRoute)
	http.Handle(metricsRoute, promhttp.Handler())
	err := http.ListenAndServe(metricsAsyncServiceHost, nil)
	if err != nil {
		log.Error().Err(err).Msg("Error starting metrics endpoint")
	}
}
