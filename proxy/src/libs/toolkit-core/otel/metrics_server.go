package otel

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/zerolog/log"
)

func ServeMetrics() {
	log.Printf("Serving metrics at %s%s", prometheusHost, metricsRoute)
	http.Handle(metricsRoute, promhttp.Handler())
	err := http.ListenAndServe(prometheusHost, nil)
	if err != nil {
		log.Error().Err(err).Msg("Error starting metrics endpoint")
	}
}
