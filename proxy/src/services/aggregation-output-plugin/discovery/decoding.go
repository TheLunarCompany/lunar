package discovery

import (
	"C"
	"fmt"
	"lunar/aggregation-plugin/common"
	"unsafe"

	"github.com/fluent/fluent-bit-go/output"
	"github.com/goccy/go-json"
	"github.com/rs/zerolog/log"
)

const (
	messageKey       = "message"
	jsonObjectPrefix = byte('{')
)

type accessLogResponse struct {
	decoded   bool
	accessLog *common.AccessLog
}

func DecodeRecords(data unsafe.Pointer, length int) []common.AccessLog {
	decoder := output.NewDecoder(data, length)
	accessLogs := []common.AccessLog{}

	for {
		ret, _, record := output.GetRecord(decoder)
		// only ret == 0 means there are more records to process
		if ret != 0 {
			break
		}
		accessLogResponse, err := decodeRecord(record)
		if err != nil {
			log.Err(err).Msg("Could not decode record")
			continue
		}
		if accessLogResponse.decoded && accessLogResponse.accessLog != nil {
			accessLogs = append(accessLogs, *accessLogResponse.accessLog)
		}
	}

	return accessLogs
}

func decodeRecord(record map[any]any) (*accessLogResponse, error) {
	recordValue, found := record[messageKey]

	if !found || recordValue == nil {
		return nil, fmt.Errorf("Key `%v` not found", messageKey)
	}

	accessLogResponse, err := decodeMessage(recordValue)
	if err != nil {
		return nil, err
	}
	return accessLogResponse, nil
}

func decodeMessage(recordValue any) (*accessLogResponse, error) {
	var raw []byte
	raw, validBytes := recordValue.([]byte)
	if !validBytes {
		return nil, fmt.Errorf("Not byte array. Will not handle")
	}

	var accessLog common.AccessLog
	// We only want to parse Json objects
	if len(raw) == 0 || raw[0] != jsonObjectPrefix {
		return &accessLogResponse{
			decoded:   false,
			accessLog: nil,
		}, nil
	}

	err := json.Unmarshal(raw, &accessLog)
	if err != nil {
		return nil, fmt.Errorf("Failed parsing JSON - %v Error: %v", err, string(raw))
	}
	if accessLog.URL == "-" {
		return nil, fmt.Errorf("Missing URL - %+v", accessLog)
	}

	return &accessLogResponse{
		decoded:   true,
		accessLog: &accessLog,
	}, nil
}
