package config

import (
	"errors"
	"fmt"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/configuration"
	contextmanager "lunar/toolkit-core/context-manager"
	"lunar/toolkit-core/vacuum"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/samber/lo"
)

const (
	configDirEnvVar      string        = "LUNAR_PROXY_CONFIG_DIR"
	policiesConfigEnvVar string        = "LUNAR_PROXY_POLICIES_CONFIG"
	policiesAccessorName string        = "PoliciesAccessor"
	vacuumTick           time.Duration = 5 * time.Second
	staleVersionTTL      time.Duration = 30 * time.Second
)

type PoliciesVersion int

type TxnID string

type PoliciesData struct {
	Config                sharedConfig.PoliciesConfig
	EndpointPolicyTree    EndpointPolicyTree
	diagnosisFreeReverted bool
}

type TxnPoliciesAccessor struct {
	currentVersion         PoliciesVersion
	policiesVersions       map[PoliciesVersion]*PoliciesData
	txnVersions            map[TxnID]PoliciesVersion
	txnVersionsVacuum      *vacuum.MapVacuum[TxnID, PoliciesVersion]
	policiesVersionsVacuum *vacuum.MapVacuum[PoliciesVersion, *PoliciesData]
	mutex                  *sync.RWMutex
	clock                  clock.Clock
}

type PoliciesAccessor interface {
	GetTxnPoliciesData(txnID TxnID) *PoliciesData
	ReloadFromFile() error
}

func (txnPoliciesAccessor *TxnPoliciesAccessor) GetTxnPoliciesData(
	txnID TxnID,
) *PoliciesData {
	txnPoliciesVersion := txnPoliciesAccessor.getTxnPoliciesVersion(txnID)
	txnPoliciesAccessor.mutex.RLock()
	policies, found := txnPoliciesAccessor.policiesVersions[txnPoliciesVersion]
	txnPoliciesAccessor.mutex.RUnlock()
	if !found {
		log.Error().
			Msgf("anchored policy version %v not found for transaction %v"+
				"will return current version instead", txnPoliciesVersion, txnID)
		return txnPoliciesAccessor.GetCurrentPoliciesData()
	}
	return policies
}

func (txnPoliciesAccessor *TxnPoliciesAccessor) ReloadFromFile() error {
	newPoliciesData, err := loadDataFromFile()
	if err != nil {
		return err
	}
	log.Debug().Msgf("Loaded policies data from file: %+v", *newPoliciesData)
	return txnPoliciesAccessor.UpdatePoliciesData(newPoliciesData, false)
}

func (txnPoliciesAccessor *TxnPoliciesAccessor) RevertToLastLoaded() error {
	policiesData, err := loadDataFromLoadedFile(false)
	if err != nil {
		return err
	}
	err = txnPoliciesAccessor.UpdatePoliciesData(policiesData, true)
	if err != nil {
		log.Error().Err(err).Msg("Failed to revert to last loaded policies")
	} else {
		log.Info().Msg("Successfully reverted to last loaded policies")
	}
	return err
}

func (txnPoliciesAccessor *TxnPoliciesAccessor) RevertToDiagnosisFree() error {
	policiesData, err := loadDataFromLoadedFile(true)
	if err != nil {
		return err
	}
	err = txnPoliciesAccessor.UpdatePoliciesData(policiesData, true)
	if err != nil {
		log.Error().Err(err).Msg("Failed to revert to diagnosis-free policies")
	} else {
		log.Info().Msg("Successfully reverted to diagnosis-free policies")
	}
	return err
}

func (txnPoliciesAccessor *TxnPoliciesAccessor) UpdateRawData(
	rawData []byte,
) error {
	configPolicy, err := configuration.UnmarshalPolicyRawData[sharedConfig.PoliciesConfig](rawData)
	if err != nil {
		return err
	}
	if err = Validate(configPolicy.UnmarshaledData); err != nil {
		return err
	}
	policyData, err := BuildPolicyData(
		configPolicy.UnmarshaledData,
		false,
	)
	if err != nil {
		return err
	}
	err = txnPoliciesAccessor.UpdatePoliciesData(policyData, false)
	if err != nil {
		return err
	}
	filePath, err := getPoliciesPath()
	if err != nil {
		return err
	}
	return os.WriteFile(filePath, rawData, 0o644)
}

func (txnPoliciesAccessor *TxnPoliciesAccessor) UpdatePoliciesData(
	newPoliciesData *PoliciesData,
	unmanageImmediately bool,
) error {
	previousConfig := txnPoliciesAccessor.GetCurrentPoliciesData().Config

	previousHAProxyEndpoints := BuildHAProxyEndpointsRequest(&previousConfig)
	newHAProxyEndpoints := BuildHAProxyEndpointsRequest(&newPoliciesData.Config)

	err := ManageHAProxyEndpoints(newHAProxyEndpoints)
	if err != nil {
		return fmt.Errorf("failed to initialize HAProxy endpoints: %v", err)
	}

	newPoliciesVersion := txnPoliciesAccessor.setNextVersion(newPoliciesData)

	shouldUnmanageGlobal := previousHAProxyEndpoints.ManageAll && !newHAProxyEndpoints.ManageAll
	haproxyEndpointsToRemove := GetEndpointsDiffToRemove(previousHAProxyEndpoints, newHAProxyEndpoints)

	// Ideally unmanaging HAProxy endpoints should occur after all possible
	// transactions have reached Engine. However, in case of a fail-safe scenario,
	// we prefer to unmanage immediately in order to try to solve the issue immediately.
	if unmanageImmediately {
		unmanageHAProxyEndpointsVoided(haproxyEndpointsToRemove)
		if shouldUnmanageGlobal {
			unmanageGlobalVoided()
		}
	} else {
		if shouldUnmanageGlobal {
			scheduleUnmanageHAProxyGlobal()
		}
		ScheduleUnmanageHAProxyEndpoints(haproxyEndpointsToRemove)
	}

	log.Info().
		Msgf("Successfully reloaded policies config, current version: %d",
			newPoliciesVersion)
	return nil
}

func (txnPoliciesAccessor *TxnPoliciesAccessor) setTxnVersion(
	txnID TxnID,
) PoliciesVersion {
	txnPoliciesAccessor.mutex.Lock()
	currentVersion := txnPoliciesAccessor.currentVersion
	txnPoliciesAccessor.txnVersions[txnID] = currentVersion
	txnPoliciesAccessor.mutex.Unlock()

	txnPoliciesAccessor.txnVersionsVacuum.VacuumKey(txnID)

	return currentVersion
}

func (txnPoliciesAccessor *TxnPoliciesAccessor) setNextVersion(
	policiesData *PoliciesData,
) PoliciesVersion {
	txnPoliciesAccessor.mutex.Lock()
	previousVersion := txnPoliciesAccessor.currentVersion
	txnPoliciesAccessor.currentVersion++
	txnPoliciesAccessor.policiesVersions[txnPoliciesAccessor.currentVersion] = policiesData
	txnPoliciesAccessor.mutex.Unlock()

	txnPoliciesAccessor.policiesVersionsVacuum.VacuumKey(previousVersion)

	return previousVersion
}

func (txnPoliciesAccessor *TxnPoliciesAccessor) getTxnPoliciesVersion(
	txnID TxnID,
) PoliciesVersion {
	txnPoliciesAccessor.mutex.RLock()
	txnPolicyVersion, found := txnPoliciesAccessor.txnVersions[txnID]
	txnPoliciesAccessor.mutex.RUnlock()
	if found {
		return txnPolicyVersion
	}

	log.Trace().Msgf("no policy version anchored for transaction ID %v, "+
		"will initialize a new one", txnID)
	return txnPoliciesAccessor.setTxnVersion(txnID)
}

func GetEndpointsDiffToRemove(src, dst *HAProxyEndpointsRequest) []string {
	oldEndpoints, newEndpoints := []string{}, []string{}
	for _, haproxyEndpoint := range src.ManagedEndpoints {
		oldEndpoints = append(oldEndpoints, haproxyEndpoint.Endpoint)
	}
	for _, haproxyEndpoint := range dst.ManagedEndpoints {
		newEndpoints = append(newEndpoints, haproxyEndpoint.Endpoint)
	}

	haproxyEndpointsToRemove, _ := lo.Difference(oldEndpoints, newEndpoints)
	return haproxyEndpointsToRemove
}

func ScheduleUnmanageHAProxyEndpoints(haproxyEndpointsToRemove []string) {
	clock := contextmanager.Get().GetClock()
	if len(haproxyEndpointsToRemove) == 0 {
		return
	}
	go func() {
		clock.Sleep(staleVersionTTL)
		unmanageHAProxyEndpointsVoided(haproxyEndpointsToRemove)
	}()
}

func scheduleUnmanageHAProxyGlobal() {
	clock := contextmanager.Get().GetClock()
	go func() {
		clock.Sleep(staleVersionTTL)
		unmanageGlobalVoided()
	}()
}

func unmanageGlobalVoided() {
	err := unmanageGlobal()
	if err != nil {
		log.Error().Err(err).Msg("Failed to unmanage global")
	}
	log.Debug().Msg("Successfully unmanaged global")
}

func unmanageHAProxyEndpointsVoided(haproxyEndpointsToRemove []string) {
	err := unmanageHAProxyEndpoints(haproxyEndpointsToRemove)
	if err != nil {
		log.Error().Err(err).Msgf("Failed to unmanage HAProxy endpoints")
		return
	}
	log.Debug().
		Msgf("Successfully unmanaged %d HAProxy endpoints",
			len(haproxyEndpointsToRemove))
}

func (txnPoliciesAccessor *TxnPoliciesAccessor) GetCurrentPoliciesData() *PoliciesData {
	txnPoliciesAccessor.mutex.RLock()
	value, found := txnPoliciesAccessor.policiesVersions[txnPoliciesAccessor.currentVersion]
	txnPoliciesAccessor.mutex.RUnlock()
	if !found {
		log.Error().
			Msgf("Could not find current version (%d) in map, "+
				"available versions: %+v, will return empty data",
				txnPoliciesAccessor.currentVersion,
				lo.Keys(txnPoliciesAccessor.policiesVersions))
		return &PoliciesData{} //nolint:exhaustruct
	}
	return value
}

type BuildResult struct {
	Accessor *TxnPoliciesAccessor
	Initial  *PoliciesData
}

// Modifies a config copy to one without diagnosis - global or endpoint-specific
func modifyIntoDiagnosisFreePoliciesConfig(
	policiesDataCopy *sharedConfig.PoliciesConfig,
) *sharedConfig.PoliciesConfig {
	policiesDataCopy.Global.Diagnosis = []sharedConfig.Diagnosis{}
	updatedEndpoints := []sharedConfig.EndpointConfig{}
	for _, endpoint := range policiesDataCopy.Endpoints {
		endpoint.Diagnosis = []sharedConfig.Diagnosis{}
		updatedEndpoints = append(updatedEndpoints, endpoint)
	}
	policiesDataCopy.Endpoints = updatedEndpoints
	return policiesDataCopy
}

func persistLoaded(policiesData *sharedConfig.PoliciesConfig) {
	path, err := getLoadedPoliciesPath(false)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get loaded policies path")
		return
	}
	err = WritePoliciesConfig(path, policiesData)
	if err != nil {
		log.Error().Err(err).Msg("Failed to encode policies config to yaml")
	}

	deepCopiedPolicyConfig, err := configuration.YAMLBasedDeepCopy(policiesData)
	if err != nil {
		log.Error().Err(err).Msg("Failed to deep copy policy config")
		return
	}
	diagnosisFreePoliciesData := modifyIntoDiagnosisFreePoliciesConfig(deepCopiedPolicyConfig)
	diagnosisFreePath, err := getLoadedPoliciesPath(true)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get diagnosis-free loaded policies path")
		return
	}
	err = WritePoliciesConfig(diagnosisFreePath, diagnosisFreePoliciesData)
	if err != nil {
		log.Error().Err(err).Msg("Failed to encode diagnosis-free policies config to yaml")
	}
}

func BuildInitialFromFile() (BuildResult, error) {
	policiesData, err := loadDataFromFile()
	if err != nil {
		return BuildResult{Accessor: nil, Initial: nil}, err
	}
	haproxyEndpoints := BuildHAProxyEndpointsRequest(&policiesData.Config)

	err = WaitForProxyHealthcheck()
	if err != nil {
		return BuildResult{Accessor: nil, Initial: nil}, err
	}

	err = ManageHAProxyEndpoints(haproxyEndpoints)
	if err != nil {
		return BuildResult{Accessor: nil, Initial: nil}, fmt.Errorf(
			"failed to initialize HAProxy endpoints: %v",
			err,
		)
	}

	txnPoliciesVersions := NewTxnPoliciesAccessor(policiesData)
	return BuildResult{
		Accessor: &txnPoliciesVersions,
		Initial:  policiesData,
	}, nil
}

func NewTxnPoliciesAccessor(policiesData *PoliciesData) TxnPoliciesAccessor {
	clock := contextmanager.Get().GetClock()
	mutex := sync.RWMutex{}
	policiesVersions := map[PoliciesVersion]*PoliciesData{
		1: policiesData,
	}
	txnVersions := map[TxnID]PoliciesVersion{}
	txnVersionsVacuum := vacuum.NewMapVacuum(
		policiesAccessorName+"Vacuum::txns",
		clock,
		staleVersionTTL,
		vacuumTick,
		txnVersions,
		&mutex,
	)
	policiesVersionsVacuum := vacuum.NewMapVacuum(
		policiesAccessorName+"Vacuum::policies",
		clock,
		staleVersionTTL,
		vacuumTick,
		policiesVersions,
		&mutex,
	)
	return TxnPoliciesAccessor{
		currentVersion:         1,
		policiesVersions:       policiesVersions,
		txnVersions:            txnVersions,
		txnVersionsVacuum:      &txnVersionsVacuum,
		policiesVersionsVacuum: &policiesVersionsVacuum,
		mutex:                  &mutex,
		clock:                  clock,
	}
}

// Serves as the main loading function - loading from the user-declared policies.yaml file
func loadDataFromFile() (*PoliciesData, error) {
	config, policiesErr := GetPoliciesConfig()
	if policiesErr != nil {
		return nil, errors.Join(
			errors.New("failed to obtain policies config"),
			policiesErr,
		)
	}

	logPolicies(config)
	persistLoaded(config)

	return BuildPolicyData(config, false)
}

func loadDataFromLoadedFile(diagnosisFree bool) (*PoliciesData, error) {
	path, err := getLoadedPoliciesPath(diagnosisFree)
	if err != nil {
		return nil, err
	}
	config, readErr := ReadPoliciesConfig(path)
	if readErr != nil {
		return nil, readErr
	}

	logPolicies(config)
	// We don't need to persist loaded policies again

	return BuildPolicyData(config, diagnosisFree)
}

func logPolicies(config *sharedConfig.PoliciesConfig) {
	logGlobalPolicies(config)
	logEndpointPolicies(config)
	logExporters(config)
	logAccounts(config)
}

func logGlobalPolicies(config *sharedConfig.PoliciesConfig) {
	for _, diagnosis := range config.Global.Diagnosis {
		diagnosisConfig := getDiagnosisConfig(diagnosis.Config)
		log.Info().Msgf(
			"Global diagnosis '%v' enabled: %v. Export to %v, config: %+v",
			diagnosis.Name, diagnosis.IsEnabled(), diagnosis.Export, diagnosisConfig,
		)
	}

	for _, remedy := range config.Global.Remedies {
		remedyConfig := getRemedyConfig(remedy.Config)
		log.Info().Msgf(
			"Global remedy '%v' enabled: %v. Config: %+v",
			remedy.Name, remedy.IsEnabled(), remedyConfig,
		)
	}
}

func logEndpointPolicies(config *sharedConfig.PoliciesConfig) {
	for _, endpoint := range config.Endpoints {
		for _, diagnosis := range endpoint.Diagnosis {
			diagnosisConfig := getDiagnosisConfig(diagnosis.Config)
			log.Info().Msgf(
				"Endpoint diagnosis '%v' for %v %v enabled: %v. Export to %v, config: %+v",
				diagnosis.Name, endpoint.Method, endpoint.URL,
				diagnosis.IsEnabled(), diagnosis.Export, diagnosisConfig,
			)
		}

		for _, remedy := range endpoint.Remedies {
			remedyConfig := getRemedyConfig(remedy.Config)
			log.Info().Msgf(
				"Endpoint remedy '%v' for %v %v enabled: %v. Config: %+v",
				remedy.Name, endpoint.Method, endpoint.URL,
				remedy.IsEnabled(), remedyConfig,
			)
		}
	}
}

func getRemedyConfig(config sharedConfig.RemedyConfig) any {
	if config.StrategyBasedThrottling != nil {
		return config.StrategyBasedThrottling
	}
	if config.AccountOrchestration != nil {
		return config.AccountOrchestration
	}
	if config.Authentication != nil {
		return config.Authentication
	}
	if config.Caching != nil {
		return config.Caching
	}
	if config.ConcurrencyBasedThrottling != nil {
		return config.ConcurrencyBasedThrottling
	}
	if config.FixedResponse != nil {
		return config.FixedResponse
	}
	if config.ResponseBasedThrottling != nil {
		return config.ResponseBasedThrottling
	}
	if config.Retry != nil {
		return config.Retry
	}
	return nil
}

func getDiagnosisConfig(config sharedConfig.DiagnosisConfig) any {
	if config.HARExporter != nil {
		return config.HARExporter
	}
	if config.MetricsCollector != nil {
		return config.MetricsCollector
	}
	if config.Void != nil {
		return config.Void
	}
	return nil
}

func logExporters(config *sharedConfig.PoliciesConfig) {
	if config.Exporters.File != nil {
		log.Info().Msgf("File exporter: %+v", config.Exporters.File)
	}
	if config.Exporters.S3 != nil {
		log.Info().Msgf("S3 exporter: %+v", config.Exporters.S3)
	}
	if config.Exporters.S3Minio != nil {
		log.Info().Msgf("S3 Minio exporter: %+v", config.Exporters.S3Minio)
	}
	if config.Exporters.Prometheus != nil {
		log.Info().Msgf("Prometheus exporter: %+v", config.Exporters.Prometheus)
	}
}

func logAccounts(config *sharedConfig.PoliciesConfig) {
	if len(config.Accounts) == 0 {
		return
	}
	accountIDs := make([]sharedConfig.AccountID, 0, len(config.Accounts))
	for accountID := range config.Accounts {
		accountIDs = append(accountIDs, accountID)
	}
	sort.Slice(accountIDs, func(i, j int) bool {
		return accountIDs[i] < accountIDs[j]
	})
	log.Info().Msgf("Accounts: %+v", accountIDs)
}

func BuildPolicyData(config *sharedConfig.PoliciesConfig, diagnosisFreeReverted bool) (
	*PoliciesData, error,
) {
	policyTree, err := BuildEndpointPolicyTree(config.Endpoints)
	if err != nil {
		return nil, errors.Join(errors.New("failed to build policy tree"), err)
	}
	notifyEnabledPlugins(config)
	return &PoliciesData{
		Config:                *config,
		EndpointPolicyTree:    *policyTree,
		diagnosisFreeReverted: diagnosisFreeReverted,
	}, nil
}

func notifyEnabledPlugins(config *sharedConfig.PoliciesConfig) {
	var enabledPlugins []string
	enabledPlugins = append(enabledPlugins,
		extractEnabledPlugin(config.Global.Remedies)...)
	enabledPlugins = append(enabledPlugins,
		extractEnabledPlugin(config.Global.Diagnosis)...)

	if len(enabledPlugins) > 0 {
		log.Log().Str("level",
			"Lunar-Init").Msgf("Enabled global plugins: [%v]",
			strings.Join(enabledPlugins, ", "))
	}

	for endpointI := range config.Endpoints {
		var enabledPlugins []string

		enabledPlugins = append(enabledPlugins,
			extractEnabledPlugin(config.Endpoints[endpointI].Remedies)...)
		enabledPlugins = append(enabledPlugins,
			extractEnabledPlugin(config.Endpoints[endpointI].Diagnosis)...)

		if len(enabledPlugins) > 0 {
			log.Log().Str("level",
				"Lunar-Init").Msgf("Enabled plugins for %v: [%v]",
				config.Endpoints[endpointI].URL, strings.Join(enabledPlugins, ", "))
		}
	}
}

func extractEnabledPlugin[T sharedConfig.PluginConfig](plugins []T) []string {
	var enabledPlugins []string
	for _, plugin := range plugins {
		if plugin.IsEnabled() {
			enabledPlugins = append(enabledPlugins, plugin.GetName())
		}
	}

	return enabledPlugins
}

func getPoliciesPath() (string, error) {
	return configuration.GetPathFromEnvVarOrDefault(
		policiesConfigEnvVar,
		"./policies.yaml",
	)
}

func getLoadedPoliciesPath(diagnosisFree bool) (string, error) {
	suffix := ""
	if diagnosisFree {
		suffix = "-diagnosis-free"
	}

	dir, err := configuration.GetPathFromEnvVarOrDefault(
		configDirEnvVar, "./",
	)
	if err != nil {
		return "", err
	}
	return dir + "/loaded-policies" + suffix + ".yaml", nil
}

func GetPoliciesConfig() (*sharedConfig.PoliciesConfig, error) {
	path, pathErr := getPoliciesPath()
	if pathErr != nil {
		return nil, pathErr
	}
	policiesConfig, readErr := ReadPoliciesConfig(path)
	if readErr != nil {
		return nil, readErr
	}

	log.Info().Msg("loaded and validated policies config")

	return policiesConfig, nil
}

// An implementation of the `PoliciesAccessor` interface that
// does not support policy versioning. Useful for unit tests.
type SimplePolicyAccessor struct {
	PoliciesData *PoliciesData
}

func (policyAccessor SimplePolicyAccessor) GetTxnPoliciesData(
	_ TxnID,
) *PoliciesData {
	return policyAccessor.PoliciesData
}

func (policyAccessor SimplePolicyAccessor) ReloadFromFile() error {
	return fmt.Errorf(
		"unsupported - SimplePolicyAccessor doesn't support versioning",
	)
}
