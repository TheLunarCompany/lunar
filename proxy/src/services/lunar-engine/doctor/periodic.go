package doctor

import (
	"encoding/json"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/logging"
	"time"

	"github.com/rs/zerolog/log"
)

const (
	MaxDoctorReportInterval = 10 * time.Minute
	livenessLogPeriod       = 5 * time.Minute
	includePoliciesEveryN   = 50
)

func ReportPeriodicallyInBackground(
	doctor *Doctor,
	period time.Duration,
	telemetryWriter *logging.LunarTelemetryWriter,
	clock clock.Clock,
) {
	go reportPeriodically(doctor, period, telemetryWriter, clock)
}

func reportPeriodically(
	doctor *Doctor,
	period time.Duration,
	telemetryWriter *logging.LunarTelemetryWriter,
	clock clock.Clock,
) {
	// add a mechanism that once in 5 minutes will report how much was reported successfully

	cycleStarted := clock.Now()
	reportedCount := 0
	var lastPoliciesHash string
	log.Debug().Msgf("Starting Lunar Doctor periodic reporting, will report every %v", period)

	for {
		<-time.After(period)
		if doctor == nil {
			log.Error().Msg("Lunar Doctor is nil, cancelling periodic reporting")
			break
		}
		report := doctor.Run()

		// spare telemetry bandwidth by not sending the same data over and over
		if report.ActivePolicies.MD5 == lastPoliciesHash {
			if reportedCount%includePoliciesEveryN != 0 {
				report.ActivePolicies.YAML = "<see previous by hash>"
			}
		} else {
			lastPoliciesHash = report.ActivePolicies.MD5
		}

		err := json.NewEncoder(telemetryWriter).Encode(report)
		if err != nil {
			log.Debug().Err(err).Msg("Failed to write Doctor report to telemetry")
		}
		reportedCount++
		if clock.Now().Sub(cycleStarted) > livenessLogPeriod {
			log.Info().Msgf("Lunar Doctor reported %d times in the last 5 minutes", reportedCount)
			cycleStarted = clock.Now()
			reportedCount = 0
		}
	}
	log.Debug().Msg("Lunar Doctor periodic reporting stopped")
}
