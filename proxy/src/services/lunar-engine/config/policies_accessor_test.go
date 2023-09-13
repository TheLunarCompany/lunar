package config_test

import (
	"lunar/engine/config"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"testing"

	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
)

func TestGetTxnPoliciesDataReturnsCurrentPoliciesWhenTxnIsNew(t *testing.T) {
	clock := clock.NewMockClock()
	policiesData := createPoliciesData("remedy_a", "remedy_b")
	txnPoliciesAccessor := config.NewTxnPoliciesAccessor(policiesData, clock)
	txnID := "1"
	res := txnPoliciesAccessor.GetTxnPoliciesData(config.TxnID(txnID))

	assert.Equal(t, policiesData, res)
}

func TestGetTxnPoliciesDataReturnsSameTxnPoliciesWhenTxnExistAndVersionChanged(
	t *testing.T,
) {
	clock := clock.NewMockClock()
	policiesDataA := createPoliciesData("remedy_a", "remedy_b")
	txnPoliciesAccessor := config.NewTxnPoliciesAccessor(policiesDataA, clock)
	txnID := "1"
	resBefore := txnPoliciesAccessor.GetTxnPoliciesData(config.TxnID(txnID))
	assert.Equal(t, policiesDataA, resBefore)
	policiesDataB := createPoliciesData("remedy_b", "remedy_c")
	err := txnPoliciesAccessor.UpdatePoliciesData(policiesDataB)
	assert.Nil(t, err)
	resAfter := txnPoliciesAccessor.GetTxnPoliciesData(config.TxnID(txnID))
	assert.Equal(t, policiesDataA, resAfter)
}

func TestGetTxnPoliciesDataReturnsLatestTxnPoliciesAfterVersionChangeAndTxnDoesNotExist( //nolint:lll
	t *testing.T,
) {
	clock := clock.NewMockClock()
	policiesDataA := createPoliciesData("remedy_a", "remedy_b")
	txnPoliciesAccessor := config.NewTxnPoliciesAccessor(policiesDataA, clock)
	policiesDataB := createPoliciesData("remedy_b", "remedy_c")
	err := txnPoliciesAccessor.UpdatePoliciesData(policiesDataB)
	assert.Nil(t, err)
	txnID := "1"
	res := txnPoliciesAccessor.GetTxnPoliciesData(config.TxnID(txnID))
	assert.Equal(t, policiesDataB, res)
}

func TestUpdatePoliciesDataDoesNotFailWhenExportersDataChanges(t *testing.T) {
	clock := clock.NewMockClock()
	policiesData := createPoliciesData("remedy_a", "remedy_b")
	policiesDataA := *policiesData
	policiesDataA.Config.Exporters = sharedConfig.Exporters{
		File: &sharedConfig.FileExporterConfig{FileDir: "foo"},
	}

	txnPoliciesAccessor := config.NewTxnPoliciesAccessor(&policiesDataA, clock)
	policiesDataB := *policiesData
	policiesDataB.Config.Exporters = sharedConfig.Exporters{
		File: &sharedConfig.FileExporterConfig{FileDir: "bar"},
	}

	err := txnPoliciesAccessor.UpdatePoliciesData(&policiesDataB)
	assert.Nil(t, err)
}

func createPoliciesData(remedyNames ...string) *config.PoliciesData {
	remedies := lo.Map(
		remedyNames,
		func(remedyName string, _ int) sharedConfig.Remedy {
			return sharedConfig.Remedy{Name: remedyName}
		},
	)
	return &config.PoliciesData{
		Config: sharedConfig.PoliciesConfig{
			Global: sharedConfig.Global{Remedies: remedies},
		},
	}
}
