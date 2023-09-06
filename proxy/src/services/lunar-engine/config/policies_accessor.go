package config

import (
	"errors"
	"fmt"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/configuration"
	"lunar/toolkit-core/vacuum"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/samber/lo"
)

const (
	policiesConfigEnvVar string        = "LUNAR_PROXY_POLICIES_CONFIG"
	policiesAccessorName string        = "PoliciesAccessor"
	vacuumTick           time.Duration = 5 * time.Second
	staleVersionTTL      time.Duration = 30 * time.Second
)

type PoliciesVersion int

type TxnID string

type PoliciesData struct {
	Config             sharedConfig.PoliciesConfig
	EndpointPolicyTree EndpointPolicyTree
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
	policies, found := txnPoliciesAccessor.policiesVersions[txnPoliciesVersion] //nolint:lll
	txnPoliciesAccessor.mutex.RUnlock()
	if !found {
		log.Error().
			Msgf("anchored policy version %v not found for transaction %v"+
				"will return current version instead", txnPoliciesVersion, txnID)
		return txnPoliciesAccessor.getCurrentPoliciesData()
	}
	return policies
}

func (txnPoliciesAccessor *TxnPoliciesAccessor) ReloadFromFile() error {
	newPoliciesData, err := loadDataFromFile()
	if err != nil {
		return err
	}
	log.Debug().Msgf("Loaded policies data from file: %+v", *newPoliciesData)
	return txnPoliciesAccessor.UpdatePoliciesData(newPoliciesData)
}

func (txnPoliciesAccessor *TxnPoliciesAccessor) UpdateRawData(
	rawData []byte,
) error {
	configPolicy, err := configuration.UnmarshalPolicyRawData[sharedConfig.PoliciesConfig](rawData) //nolint:lll
	if err != nil {
		return err
	}
	if err := Validate(configPolicy); err != nil {
		return err
	}
	policyData, err := BuildPolicyData(configPolicy)
	if err != nil {
		return err
	}
	err = txnPoliciesAccessor.UpdatePoliciesData(policyData)
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
) error {
	previousConfig := txnPoliciesAccessor.getCurrentPoliciesData().Config

	previousHAProxyEndpoints := BuildHAProxyEndpointsRequest(&previousConfig)
	newHAProxyEndpoints := BuildHAProxyEndpointsRequest(&newPoliciesData.Config)

	err := manageHAProxyEndpoints(newHAProxyEndpoints)
	if err != nil {
		return fmt.Errorf("Failed to initialize HAProxy endpoints: %v", err)
	}

	newPoliciesVersion := txnPoliciesAccessor.setNextVersion(newPoliciesData)

	// Unmanaging HAProxy endpoints should occur after all possible
	// transactions have reached Engine
	haproxyEndpointsToRemove, _ := lo.Difference(
		previousHAProxyEndpoints.ManagedEndpoints,
		newHAProxyEndpoints.ManagedEndpoints,
	)
	scheduleUnmanageHAProxyEndpoints(
		haproxyEndpointsToRemove,
		txnPoliciesAccessor.clock,
	)

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
	txnPoliciesAccessor.policiesVersions[txnPoliciesAccessor.currentVersion] = policiesData //nolint:lll
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

	log.Debug().Msgf("No policy version anchored for transaction ID %v, "+
		"will initialize a new one", txnID)
	return txnPoliciesAccessor.setTxnVersion(txnID)
}

func scheduleUnmanageHAProxyEndpoints(
	haproxyEndpointsToRemove []string,
	clock clock.Clock,
) {
	if len(haproxyEndpointsToRemove) == 0 {
		return
	}
	go func() {
		clock.Sleep(staleVersionTTL)
		err := unmanageHAProxyEndpoints(haproxyEndpointsToRemove)
		if err != nil {
			log.Error().Err(err).Msgf("Failed to unmanage HAProxy endpoints")
			return
		}
		log.Info().
			Msgf("Successfully unmanaged %d HAProxy endpoints",
				len(haproxyEndpointsToRemove))
	}()
}

func (txnPoliciesAccessor *TxnPoliciesAccessor) getCurrentPoliciesData() *PoliciesData { //nolint:lll
	txnPoliciesAccessor.mutex.RLock()
	value, found := txnPoliciesAccessor.policiesVersions[txnPoliciesAccessor.currentVersion] //nolint:lll
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

func BuildInitialFromFile(
	clock clock.Clock,
) (BuildResult, error) {
	policiesData, err := loadDataFromFile()
	if err != nil {
		return BuildResult{Accessor: nil, Initial: nil}, err
	}
	haproxyEndpoints := BuildHAProxyEndpointsRequest(&policiesData.Config)

	err = waitForHealthcheck(clock)
	if err != nil {
		return BuildResult{Accessor: nil, Initial: nil}, err
	}

	err = manageHAProxyEndpoints(haproxyEndpoints)
	if err != nil {
		return BuildResult{Accessor: nil, Initial: nil}, fmt.Errorf(
			"Failed to initialize HAProxy endpoints: %v",
			err,
		)
	}

	txnPoliciesVersions := NewTxnPoliciesAccessor(policiesData, clock)
	return BuildResult{
		Accessor: &txnPoliciesVersions,
		Initial:  policiesData,
	}, nil
}

func NewTxnPoliciesAccessor(
	policiesData *PoliciesData,
	clock clock.Clock,
) TxnPoliciesAccessor {
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

func loadDataFromFile() (*PoliciesData, error) {
	config, policiesErr := GetPoliciesConfig()
	if policiesErr != nil {
		return nil, errors.Join(
			errors.New("Failed to obtain policies config"),
			policiesErr,
		)
	}
	return BuildPolicyData(config)
}

func BuildPolicyData(config *sharedConfig.PoliciesConfig) (
	*PoliciesData, error,
) {
	policyTree, err := BuildEndpointPolicyTree(config.Endpoints)
	if err != nil {
		return nil, errors.Join(errors.New("Failed to build policy tree"), err)
	}
	notifyEnabledPlugins(config)
	return &PoliciesData{
		Config:             *config,
		EndpointPolicyTree: *policyTree,
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
		"Unsupported - SimplePolicyAccessor doesn't support versioning",
	)
}
