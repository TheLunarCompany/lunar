package streamconfig

import (
	"lunar/engine/config"

	"github.com/rs/zerolog/log"
)

func (o *GetOperation) Apply(
	fsOperations *config.FileSystemOperation,
) (*ContractResponsePayload, error) {
	log.Trace().Msg("Getting configuration")

	confPayload := NewConfigurationPayload()

	if err := confPayload.LoadPayloadContentFromDisk(fsOperations); err != nil {
		log.Error().Err(err).Msg("Failed to load payload content from disk")
		return nil, err
	}

	if err := confPayload.PreparePayload(); err != nil {
		log.Error().Err(err).Msg("Failed to prepare payload")
		return nil, err
	}

	resp := NewContractResponsePayload()
	resp.OperationResponse.Get = NewGetOperationResponse()
	resp.OperationResponse.Get.Configurations = append(
		resp.OperationResponse.Get.Configurations,
		&GetOperationResponsePayload{
			Name:          "lunar-proxy",
			Configuration: confPayload,
		},
	)

	return resp, nil
}

// Apply applies the init operation to the configuration
// It resets all the configuration files to their default state
func (o *InitOperation) Apply(
	fsOperations *config.FileSystemOperation,
) (*ContractResponsePayload, error) {
	log.Trace().Msg("Initiating configuration")
	if err := fsOperations.CleanAll(); err != nil {
		return nil, err
	}
	resp := NewContractResponsePayload()
	resp.OperationResponse.Init = NewResponse()
	return resp, nil
}

func (o *WriteOperation) Apply(
	fsOperations *config.FileSystemOperation,
) (*ContractResponsePayload, error) {
	log.Trace().Msg("Updating configuration")

	if err := o.SavePayloadContentToDisk(fsOperations); err != nil {
		log.Error().Err(err).Msg("Failed to save payload content to disk")
		return nil, err
	}

	resp := NewContractResponsePayload()
	resp.OperationResponse.Init = NewResponse()
	return resp, nil
}

// Apply applies the delete operation to the configuration
// It deletes the specified configuration files
// If the all flag is set, it deletes all the configuration files
func (o *DeleteOperation) Apply(
	fsOperations *config.FileSystemOperation,
) (*ContractResponsePayload, error) {
	log.Trace().Msg("Deleting configuration")

	resp := NewContractResponsePayload()
	resp.OperationResponse.Init = NewResponse()

	if o.All {
		return resp, fsOperations.CleanAll()
	}
	if o.Flows {
		if err := fsOperations.CleanFlowsDirectory(); err != nil {
			return nil, err
		}
	}
	if o.FlowByName != nil {
		for _, flow := range o.FlowByName {
			if err := fsOperations.CleanFlow(flow); err != nil {
				return nil, err
			}
		}
	}
	if o.Quotas {
		if err := fsOperations.CleanQuotasDirectory(); err != nil {
			return nil, err
		}
	}
	if o.QuotaByName != nil {
		for _, quota := range o.QuotaByName {
			if err := fsOperations.CleanQuota(quota); err != nil {
				return nil, err
			}
		}
	}

	if o.PathParams {
		if err := fsOperations.CleanPathParamsDirectory(); err != nil {
			return nil, err
		}
	}
	if o.PathParamByName != nil {
		for _, pathParam := range o.PathParamByName {
			if err := fsOperations.CleanPathParams(pathParam); err != nil {
				return nil, err
			}
		}
	}
	if o.GatewayConfig {
		if err := fsOperations.CleanGatewayConfigFile(); err != nil {
			return nil, err
		}
	}
	if o.Metrics {
		if err := fsOperations.CleanMetricsConfigFile(); err != nil {
			return nil, err
		}
	}
	return resp, nil
}
