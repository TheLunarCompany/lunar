package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"lunar/engine/streams/validation"
	"lunar/engine/utils"
	"net/http"
	"os"
	"path/filepath"
)

func main() {
	http.HandleFunc(ValidationEndpointPath, validateFlowsHandler)

	port := GetValidatorPort()
	fmt.Printf("Flows Validator Server is running on port %v\n", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		fmt.Printf("Error starting server: %v\n", err)
	}
}

func validateFlowsHandler(writer http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodPost {
		http.Error(writer, "Invalid method, only POST is allowed", http.StatusMethodNotAllowed)
		return
	}

	var input ValidationInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		http.Error(writer, fmt.Sprintf("Invalid JSON input: %v", err), http.StatusBadRequest)
		return
	}

	var result ValidationResult
	if !input.IsFolderSpecified() {
		// Clear existing setup, if any
		if err := os.RemoveAll(input.GetRoot()); err != nil && !os.IsNotExist(err) {
			http.Error(writer,
				fmt.Sprintf("Failed to clear existing setup: %v", err), http.StatusInternalServerError)
			return
		}

		// Write Base64 files to folder
		if err := os.Mkdir(input.GetRoot(), 0o755); err != nil && !os.IsExist(err) {
			http.Error(writer,
				fmt.Sprintf("Failed to create folder: %v", err), http.StatusInternalServerError)
			return
		}

		if err := ensureFoldersExist(input); err != nil {
			http.Error(writer,
				fmt.Sprintf("Failed to create folders: %v", err), http.StatusInternalServerError)
			return
		}

		if err := writeSetupFilesToDir(input); err != nil {
			http.Error(writer, fmt.Sprintf("Failed to write files: %v", err), http.StatusInternalServerError)
			return
		}
	}

	result = validateFlowsSetup(input)
	writer.Header().Set("Content-Type", "application/json")
	json.NewEncoder(writer).Encode(result)

	// remove setup
	if !input.IsFolderSpecified() {
		_ = os.RemoveAll(input.GetRoot())
	}
}

func validateFlowsSetup(input ValidationInput) ValidationResult {
	validation := validation.NewValidator().WithValidationDir(input.GetRoot())
	if err := validation.Validate(); err != nil {
		err = utils.LastErrorWithUnwrappedDepth(err, 1)
		return ValidationResult{
			Success: false,
			Message: fmt.Sprintf("Validation failed: %v", err.Error()),
		}
	}

	return ValidationResult{
		Success: true,
		Message: "Validation completed successfully",
	}
}

func ensureFoldersExist(input ValidationInput) error {
	paths := []string{
		input.GetFlowsPath(),
		input.GetQuotasPath(),
		input.GetPathParamsPath(),
	}

	for _, path := range paths {
		if err := os.MkdirAll(path, 0o755); err != nil && !os.IsExist(err) {
			return fmt.Errorf("failed to create directory %s: %v", path, err)
		}
	}
	return nil
}

func writeSetupFilesToDir(input ValidationInput) error {
	if input.GatewayConfig != "" {
		if err := writeBase64File(input.GatewayConfig, input.GetGatewayConfigPath()); err != nil {
			return err
		}
	}

	for i, flow := range input.Flows {
		file := fmt.Sprintf("flow_%d.yaml", i+1)
		if err := writeBase64File(flow, filepath.Join(input.GetFlowsPath(), file)); err != nil {
			return err
		}
	}

	for i, pathParam := range input.PathParams {
		file := fmt.Sprintf("path_param_%d.yaml", i+1)
		if err := writeBase64File(pathParam, filepath.Join(input.GetPathParamsPath(), file)); err != nil {
			return err
		}
	}

	for i, quota := range input.Quotas {
		file := fmt.Sprintf("quota_%d.yaml", i+1)
		if err := writeBase64File(quota, filepath.Join(input.GetQuotasPath(), file)); err != nil {
			return err
		}
	}

	return nil
}

func writeBase64File(encodedData, filePath string) error {
	data, err := base64.StdEncoding.DecodeString(encodedData)
	if err != nil {
		return fmt.Errorf("failed to decode Base64 data: %v", err)
	}

	if err := os.WriteFile(filePath, data, 0o644); err != nil {
		return fmt.Errorf("failed to write file: %v", err)
	}

	return nil
}
