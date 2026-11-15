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
	includeConfigEveryN     = 50
	excludeConfigMessage    = "<see previous by hash>"
)

func ReportPeriodicallyInBackground(
	doctor *Doctor,
	period time.Duration,
	telemetryWriter *logging.LunarLogger,
	clock clock.Clock,
) {
	if telemetryWriter == nil {
		// We need to change the use of writer(telemetryWriter) and wrap it as an
		// object that will be used to get the writer if exists etc..
		// TODO: implement this
		log.Warn().Msg("Telemetry is disabled, will not report Doctor telemetry")
		return
	}
	go reportPeriodically(doctor, period, telemetryWriter, clock)
}

func reportPeriodically(
	doctor *Doctor,
	period time.Duration,
	telemetryWriter *logging.LunarLogger,
	clock clock.Clock,
) {
	// add a mechanism that once in 5 minutes will report how much was reported successfully

	cycleStarted := clock.Now()
	// TODO: Add restart to the reportedCount.
	var reportedCount int64

	var lastPoliciesHash string
	lastStreamsFileHashes := make(map[string]string)

	log.Debug().Msgf("Starting Lunar Doctor periodic reporting, will report every %v", period)

	for {
		<-time.After(period)
		if doctor == nil {
			log.Error().Msg("Lunar Doctor is nil, cancelling periodic reporting")
			break
		}

		report := doctor.Run()

		// spare telemetry bandwidth by not sending the same data over and over
		if report.ActivePolicies != nil {
			if report.ActivePolicies.MD5 == lastPoliciesHash {
				if reportedCount%includeConfigEveryN != 0 {
					report.ActivePolicies.YAML = excludeConfigMessage
				}
			} else {
				lastPoliciesHash = report.ActivePolicies.MD5
			}
		}

		if report.LoadedStreamsConfig != nil {
			for i := range report.LoadedStreamsConfig.Data {
				payload := &report.LoadedStreamsConfig.Data[i]
				if payload.MD5 == lastStreamsFileHashes[payload.FileName] {
					if reportedCount%includeConfigEveryN != 0 {
						payload.Content = excludeConfigMessage
					}
				} else {
					lastStreamsFileHashes[payload.FileName] = payload.MD5
				}
			}
		}

		if telemetryWriter == nil {
			log.Warn().Msg("Lunar Doctor telemetry writer is nil, cancelling periodic reporting")
			break
		}
		err := json.NewEncoder(telemetryWriter).Encode(report)
		if err != nil {
			log.Debug().Err(err).Msg("Failed to write Doctor report to telemetry")
		}
		reportedCount++
		if clock.Now().Sub(cycleStarted) > livenessLogPeriod {
			log.Debug().Msgf("Lunar Doctor reported %d times in the last 5 minutes", reportedCount)
			cycleStarted = clock.Now()
		}
	}
	log.Debug().Msg("Lunar Doctor periodic reporting stopped")
}
