package routing

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"lunar/engine/config"
	"lunar/engine/doctor"
	"lunar/engine/utils/writers"
	"net/http"
	"os"

	"github.com/rs/zerolog/log"
)

const (
	managedKey string = "LUNAR_MANAGED"
)

var (
	managedValue = os.Getenv(managedKey)
	managed      = isManaged()
)

func isManaged() bool {
	return managedValue == "true"
}

type handshake struct {
	Managed bool `json:"managed"`
}

func readJSONFile(filePath string) ([]byte, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		log.Error().Err(err).Stack().Msgf("Failed to read %s", filePath)
	}
	return content, err
}

func handleJSONResponse(writer http.ResponseWriter, data []byte) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(writer).Encode(
		map[string]string{"data": string(data)}); err != nil {
		log.Error().Err(err).Stack().Msg("Failed encoding response")
	}
}

func handleError(writer http.ResponseWriter, message string, status int,
	err error,
) {
	http.Error(writer, fmt.Sprintf(`{"msg": "%s", "error": "%v"}`, message, err), status)
	log.Error().Err(err).Stack().Msg(message)
}

func SuccessResponse(writer http.ResponseWriter, message string) {
	log.Trace().Msg(message)
	fmt.Fprintf(writer, `{"msg": "%s"}`, message)
}

func HandleApplyPolicies(
	policyAccessor *config.TxnPoliciesAccessor,
	exportWriter writers.Writer,
) func(http.ResponseWriter, *http.Request) {
	return func(writer http.ResponseWriter, req *http.Request) {
		switch req.Method {
		case http.MethodPost:
			// We close the writer to allow it to reconnect.
			// We need this as the Fluent Bit is restarted for the exports reload.
			_ = exportWriter.Close()
			body, err := io.ReadAll(req.Body)
			if err != nil {
				handleError(writer,
					"Error reading request body",
					http.StatusUnprocessableEntity, err)
				return
			}
			defer req.Body.Close()

			if len(body) > 0 {
				err = policyAccessor.UpdateRawData(body)
				if err != nil {
					handleError(writer,
						"Failed to apply policies from file",
						http.StatusUnprocessableEntity, err)
					return
				}
			}

			err = policyAccessor.ReloadFromFile()
			if err != nil {
				handleError(writer,
					"Failed to apply policies from file",
					http.StatusUnprocessableEntity, err)
				return
			}

			SuccessResponse(writer, "✅ Successfully applied policies from file")
		default:
			http.Error(writer, "Unsupported Method", http.StatusMethodNotAllowed)
		}
	}
}

func HandleRevertToDiagnosisFree(
	policyAccessor *config.TxnPoliciesAccessor,
	exportWriter writers.Writer,
) func(http.ResponseWriter, *http.Request) {
	return func(writer http.ResponseWriter, req *http.Request) {
		switch req.Method {
		case http.MethodPost:
			// We close the writer to allow it to reconnect.
			// We need this as the Fluent Bit is restarted for the exports reload.
			_ = exportWriter.Close()
			defer req.Body.Close()

			err := policyAccessor.RevertToDiagnosisFree()
			if err != nil {
				handleError(writer,
					"Failed to revert to diagnosis free",
					http.StatusUnprocessableEntity, err)
				return
			}

			SuccessResponse(writer, "✅ Successfully reverted to diagnosis free")
		default:
			http.Error(writer, "Unsupported Method", http.StatusMethodNotAllowed)
		}
	}
}

func HandleRevertToLastLoaded(
	policyAccessor *config.TxnPoliciesAccessor,
	exportWriter writers.Writer,
) func(http.ResponseWriter, *http.Request) {
	return func(writer http.ResponseWriter, req *http.Request) {
		switch req.Method {
		case http.MethodPost:
			// We close the writer to allow it to reconnect.
			// We need this as the Fluent Bit is restarted for the exports reload.
			_ = exportWriter.Close()
			defer req.Body.Close()

			err := policyAccessor.RevertToLastLoaded()
			if err != nil {
				handleError(writer,
					"Failed to revert to last loaded",
					http.StatusUnprocessableEntity, err)
				return
			}

			SuccessResponse(writer, "✅ Successfully reverted to last loaded")
		default:
			http.Error(writer, "Unsupported Method", http.StatusMethodNotAllowed)
		}
	}
}

func HandleValidatePolicies() func(http.ResponseWriter, *http.Request) {
	return func(writer http.ResponseWriter, req *http.Request) {
		switch req.Method {
		case http.MethodPost:
			_, err := config.GetPoliciesConfig()
			if err != nil {
				handleError(writer,
					fmt.Sprintf("Failed to validate policies: %v", err),
					http.StatusUnprocessableEntity, err)
				return
			}
			SuccessResponse(writer, "✅ Successfully validated policies from file")
		default:
			http.Error(writer, "Unsupported Method", http.StatusMethodNotAllowed)
		}
	}
}

func HandleJSONFileRead(location string) func(
	http.ResponseWriter, *http.Request) {
	return func(writer http.ResponseWriter, req *http.Request) {
		switch req.Method {
		case http.MethodGet:
			data, err := readJSONFile(location)
			if err != nil {
				handleError(writer,
					fmt.Sprintf("Failed to read %s: %v", location, err),
					http.StatusUnprocessableEntity, err)
				return
			}
			handleJSONResponse(writer, data)
		default:
			http.Error(writer, "Unsupported Method", http.StatusMethodNotAllowed)
		}
	}
}

func HandleHandshake() func(
	http.ResponseWriter, *http.Request) {
	return func(writer http.ResponseWriter, req *http.Request) {
		switch req.Method {
		case http.MethodGet:
			writer.Header().Set("Content-Type", "application/json")
			writer.WriteHeader(http.StatusOK)
			log.Debug().Msg("✅ Handshake successful.")
			err := json.NewEncoder(writer).Encode(&handshake{Managed: managed})
			if err != nil {
				log.Error().Err(err).Stack().Msg("Failed encoding response")
			}
		default:
			http.Error(writer, "Unsupported Method", http.StatusMethodNotAllowed)
		}
	}
}

func HandleDoctorRequest(doctor *doctor.Doctor) func(
	http.ResponseWriter, *http.Request) {
	return func(writer http.ResponseWriter, req *http.Request) {
		switch req.Method {
		case http.MethodGet:
			writer.Header().Set("Content-Type", "application/json")
			if doctor == nil {
				handleError(
					writer,
					"Failed to encode doctor report",
					http.StatusUnprocessableEntity,
					errors.New("doctor is nil"),
				)
				return
			}
			report := doctor.Run()
			err := json.NewEncoder(writer).Encode(report)
			if err != nil {
				handleError(writer,
					"Failed to encode doctor report",
					http.StatusUnprocessableEntity, err)
				return
			}
		default:
			http.Error(writer, "Unsupported Method", http.StatusMethodNotAllowed)
		}
	}
}
