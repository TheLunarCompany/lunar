package failsafe

import (
	"errors"
	"io"
	"lunar/engine/config"
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/clock"
	"net/http"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

const (
	statsCSVEndpoint       = "http://localhost:9000/metrics;csv"
	spoeBackendProxyName   = "lunar"
	spoeBackendServiceName = "BACKEND"
)

func NewDiagnosisFailsafeStateChangeWatcher(
	txnPoliciesAccessor *config.TxnPoliciesAccessor,
	clock clock.Clock,
) (*StateChangeWatcher, error) {
	minTimeBetweenCalls, err := environment.GetDiagnosisFailsafeMinTimeBetweenCalls()
	if err != nil {
		return nil, err
	}
	consecutiveN, err := environment.GetDiagnosisFailsafeConsecutiveN()
	if err != nil {
		return nil, err
	}
	minStablePeriod, err := environment.GetDiagnosisFailsafeMinStablePeriod()
	if err != nil {
		return nil, err
	}
	cooldownPeriod, err := environment.GetDiagnosisFailsafeCooldownPeriod()
	if err != nil {
		return nil, err
	}

	logger := log.With().
		Str("component", "StateChangeWatcher").
		Logger()

	return NewStateChangeWatcher(
		"diagnosis-failsafe",
		Config{
			ObtainPredicate:     func() bool { return areSPOEConnectionsHealthy(logger) },
			OnChangeToTrue:      func() { diagnosisFailsafeOnChangesToTrue(txnPoliciesAccessor, logger) },
			OnChangeToFalse:     func() { diagnosisFailsafeOnChangesToFalse(txnPoliciesAccessor, logger) },
			StateTrueName:       "connections-healthy",
			StateFalseName:      "connections-unhealthy",
			MinTimeBetweenCalls: minTimeBetweenCalls,
			ConsecutiveN:        consecutiveN,
			MinStablePeriod:     minStablePeriod,
			CooldownPeriod:      cooldownPeriod,
		}, clock, logger), nil
}

func areSPOEConnectionsHealthy(logger zerolog.Logger) bool {
	healthyMaxLastSession, err := environment.GetDiagnosisFailsafeHealthyMaxLastSession()
	if err != nil {
		logger.Error().
			Stack().
			Err(err).
			Msg("Could not get env var for healthy max last session, will not evaluate")
		return true
	}
	healthySessionRate, err := environment.GetDiagnosisFailsafeHealthySessionRate()
	if err != nil {
		logger.Error().
			Stack().
			Err(err).
			Msg("Could not get env var for healthy session rate, will not evaluate")
		return true
	}
	logger.Trace().Msg("Sending request to HAProxy metrics")
	stats, err := getHAProxyStats()
	if err != nil {
		logger.Error().
			Stack().
			Err(err).
			Msg("Could not get HAProxy metrics, will not evaluate")
		return true
	}

	var spoeBackendStat *Stat
	for _, stat := range stats {
		if stat.ProxyName == spoeBackendProxyName && stat.ServiceName == spoeBackendServiceName {
			spoeBackendStat = &stat
			break
		}
	}
	if spoeBackendStat == nil {
		logger.Error().
			Msg("Could not find the SPOE backend in the HAProxy metrics, will not evaluate")
		return true
	}

	// Core business logic - this is where the evaluation actually happens
	if spoeBackendStat.SessionRate != nil && spoeBackendStat.LastSession != nil {
		logger.Trace().Msgf("sessionRate: %v, lastSession: %v",
			*spoeBackendStat.SessionRate, *spoeBackendStat.LastSession)

		return *spoeBackendStat.SessionRate == healthySessionRate &&
			*spoeBackendStat.LastSession > healthyMaxLastSession
	}
	// if the required fields are not present, we cannot evaluate
	return true
}

func diagnosisFailsafeOnChangesToFalse(
	txnPoliciesAccessor *config.TxnPoliciesAccessor,
	logger zerolog.Logger,
) {
	if txnPoliciesAccessor == nil {
		logger.Error().
			Msg("Diagnosis failsafe activation required but no accessor provided")
		return
	}
	err := txnPoliciesAccessor.RevertToDiagnosisFree()
	if err != nil {
		logger.Error().
			Stack().
			Err(err).
			Msg("Diagnosis failsafe activation required but failed")
	}
}

func diagnosisFailsafeOnChangesToTrue(
	txnPoliciesAccessor *config.TxnPoliciesAccessor,
	logger zerolog.Logger,
) {
	if txnPoliciesAccessor == nil {
		logger.Error().
			Msg("Diagnosis failsafe deactivation required but no accessor provided")
		return
	}

	err := txnPoliciesAccessor.RevertToLastLoaded()
	if err != nil {
		logger.Error().
			Stack().
			Err(err).
			Msg("Diagnosis failsafe revert required but failed")
	}
}

func getHAProxyStats() ([]Stat, error) {
	request, err := http.NewRequest(http.MethodGet, statsCSVEndpoint, nil)
	if err != nil {
		return nil, errors.Join(err, errors.New("failed to create request to HAProxy metrics"))
	}

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return nil, errors.Join(err, errors.New("failed to send request to HAProxy metrics"))
	}
	bodyBytes, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, errors.Join(
			err,
			errors.New("failed to read response body from HAProxy metrics"),
		)
	}
	body := string(bodyBytes)
	if response.StatusCode != http.StatusOK {
		return nil, errors.Join(err, errors.New("failed to get HAProxy metrics"))
	}

	stats, err := ParseHAProxyStatsCSV(body)
	if err != nil {
		return nil, errors.Join(err, errors.New("failed to parse HAProxy metrics"))
	}
	return stats, nil
}
