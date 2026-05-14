package common

import (
	"os"

	"github.com/rs/zerolog/log"
	"gopkg.in/yaml.v2"
)

type metricsData struct {
	GeneralMetrics struct {
		LabelValue []string `yaml:"label_value"`
	} `yaml:"general_metrics"`
}

// GetSupportedMetricsLabels reads the metrics file and returns the supported metrics labels
func GetSupportedMetricsLabels() (labels []string) {
	filePath := os.Getenv("LUNAR_PROXY_METRICS_CONFIG")
	_, err := os.Stat(filePath)
	if err != nil {
		filePath = os.Getenv("LUNAR_PROXY_METRICS_CONFIG_DEFAULT")
	}

	log.Trace().Msgf("Metrics file path: %s", filePath)
	file, err := os.Open(filePath)
	if err != nil {
		log.Trace().Err(err).Msg("Failed to open metrics file")
		return
	}
	defer file.Close()

	var metrics metricsData
	decoder := yaml.NewDecoder(file)
	if err := decoder.Decode(&metrics); err != nil {
		log.Trace().Err(err).Msg("Failed to decode YAML")
		return
	}
	log.Trace().Msgf("Metrics labels: %+v", metrics)
	return metrics.GeneralMetrics.LabelValue
}
