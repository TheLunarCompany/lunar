package streamconfig

import (
	configstate "lunar/engine/streams/config-state"
	"lunar/engine/utils/environment"
	"path"

	"github.com/rs/zerolog/log"
)

func (o *GetOperation) Apply() (*ContractResponsePayload, error) {
	log.Trace().Msg("Getting configuration")

	resp := NewContractResponsePayload()
	resp.OperationResponse.Get = NewGetOperationResponse()

	payloads := make([]*GetOperationResponsePayload, 0)
	confPayload := NewConfigurationPayload()
	payloads = append(payloads, &GetOperationResponsePayload{
		Name:          "lunar-proxy",
		Configuration: confPayload,
	})

	if o.All {
		configState := configstate.Get()
		backups, err := configState.ListBackups()
		if err != nil {
			log.Trace().Err(err).Msg("Failed to list backups")
		}
		for _, backup := range backups {
			backupDir := path.Join(environment.GetConfigBackupDirectory(), backup)
			backupPayload := NewConfigurationPayloadFromPath(backupDir)

			payloads = append(payloads, &GetOperationResponsePayload{
				Name:          backup,
				Configuration: backupPayload,
			})
		}
	}

	for _, payload := range payloads {
		if err := payload.Configuration.LoadPayloadContentFromDisk(); err != nil {
			log.Error().Err(err).Msg("Failed to load payload content from disk")
			return nil, err
		}

		if err := payload.Configuration.PreparePayload(); err != nil {
			log.Error().Err(err).Msg("Failed to prepare payload")
			return nil, err
		}
	}

	resp.OperationResponse.Get.Configurations = payloads
	return resp, nil
}

func (o *RestoreOperation) Apply() (*ContractResponsePayload, error) {
	log.Trace().Msg("Restoring configuration")

	if err := configstate.Get().RestoreCheckpoint(o.Checkpoint); err != nil {
		log.Error().Err(err).Msg("Failed to restore configuration")
		return nil, err
	}

	resp := NewContractResponsePayload()
	resp.OperationResponse.Restore = NewResponse()
	return resp, nil
}

// Apply applies the init operation to the configuration
// It resets all the configuration files to their default state
func (o *InitOperation) Apply() (*ContractResponsePayload, error) {
	log.Trace().Msg("Initiating configuration")
	if err := configstate.Get().Clean(); err != nil {
		return nil, err
	}

	if err := configstate.Get().RestoreMetricsConfig(); err != nil {
		log.Error().Err(err).Msg("Failed to restore metrics config")
		return nil, err
	}

	resp := NewContractResponsePayload()
	resp.OperationResponse.Init = NewResponse()
	return resp, nil
}

func (o *WriteOperation) Apply() (*ContractResponsePayload, error) {
	log.Trace().Msg("Updating configuration")

	if err := o.SavePayloadContentToDisk(); err != nil {
		log.Error().Err(err).Msg("Failed to save payload content to disk")
		return nil, err
	}

	resp := NewContractResponsePayload()
	resp.OperationResponse.Update = NewResponse()
	return resp, nil
}

// Apply applies the delete operation to the configuration
// It deletes the specified configuration files
// If the all flag is set, it deletes all the configuration files
func (o *DeleteOperation) Apply() (*ContractResponsePayload, error) {
	log.Trace().Msg("Deleting configuration")

	configState := configstate.Get()

	resp := NewContractResponsePayload()
	resp.OperationResponse.Delete = NewResponse()

	if o.All {
		return resp, configState.Clean()
	}
	if o.Flows {
		if err := configState.CleanFlowsDirectory(); err != nil {
			return nil, err
		}
	}
	if o.FlowByName != nil {
		for _, flow := range o.FlowByName {
			if err := configState.CleanFlow(flow); err != nil {
				return nil, err
			}
		}
	}
	if o.Quotas {
		if err := configState.CleanQuotasDirectory(); err != nil {
			return nil, err
		}
	}
	if o.QuotaByName != nil {
		for _, quota := range o.QuotaByName {
			if err := configState.CleanQuota(quota); err != nil {
				return nil, err
			}
		}
	}

	if o.PathParams {
		if err := configState.CleanPathParamsDirectory(); err != nil {
			return nil, err
		}
	}
	if o.PathParamByName != nil {
		for _, pathParam := range o.PathParamByName {
			if err := configState.CleanPathParams(pathParam); err != nil {
				return nil, err
			}
		}
	}
	if o.GatewayConfig {
		if err := configState.CleanGatewayConfigFile(); err != nil {
			return nil, err
		}
	}
	if o.Metrics {
		if err := configState.CleanMetricsConfigFile(); err != nil {
			return nil, err
		}
	}
	return resp, nil
}
