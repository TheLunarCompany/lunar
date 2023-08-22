package logging

import "os"

const (
	telemetricServerPortEnvVar string = "LUNAR_TELEMETRY_SERVER_PORT"
	telemetricEnabledKey       string = "LUNAR_TELEMETRY"
)

func getTelemetricServerPort() string {
	return os.Getenv(telemetricServerPortEnvVar)
}

func getTelemetricEnableStatus() string {
	return os.Getenv(telemetricEnabledKey)
}
