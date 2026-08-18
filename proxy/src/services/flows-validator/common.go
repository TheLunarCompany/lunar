package main

import (
	"lunar/engine/utils/environment"
	"os"
	"path"
)

const (
	DefaultRoot            = "lunar-proxy"
	DefaultPort            = "8083"
	ValidationEndpointPath = "/validate-flows"
	ValidatorPortEnvVar    = "LUNAR_VALIDATOR_PORT"
)

func GetValidatorPort() string {
	port := os.Getenv(ValidatorPortEnvVar)
	if port == "" {
		return DefaultPort
	}
	return port
}

// ValidationInput represents the input for validation.
type ValidationInput struct {
	ID string `json:"id,omitempty"` // ID of setup, used as root folder. If empty, default will be used

	FolderPath    string   `json:"folder_path,omitempty"`
	GatewayConfig string   `json:"gateway_config,omitempty"`
	Flows         []string `json:"flows,omitempty"`
	PathParams    []string `json:"path_params,omitempty"`
	Quotas        []string `json:"quotas,omitempty"`
}

// ValidationResult represents the output of validation.
type ValidationResult struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func (v *ValidationInput) IsFolderSpecified() bool {
	return v.FolderPath != ""
}

func (v *ValidationInput) GetRoot() string {
	if v.FolderPath != "" {
		return v.FolderPath
	}

	if v.ID == "" {
		v.ID = DefaultRoot
	}
	return path.Join(".", v.ID)
}

func (v *ValidationInput) GetFlowsPath() string {
	return environment.GetCustomFlowsDirectory(v.GetRoot())
}

func (v *ValidationInput) GetPathParamsPath() string {
	return environment.GetCustomPathParamsDirectory(v.GetRoot())
}

func (v *ValidationInput) GetGatewayConfigPath() string {
	return environment.GetCustomGatewayConfigPath(v.GetRoot())
}

func (v *ValidationInput) GetQuotasPath() string {
	return environment.GetCustomQuotasDirectory(v.GetRoot())
}
